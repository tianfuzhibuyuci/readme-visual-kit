import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, mkdir, readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {validate, renderSvg, wrapText, renderPreview, generate, snippet} from '../scripts/kit.mjs';

const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rvk-test-'));
  await writeFile(path.join(root, 'README.md'), '# Demo\nInput\nProcess\nOutput\n');
  const node = (id, label) => ({id, label, detail: 'Local & editable <diagram>', evidence: [{path: 'README.md', start: 1, end: 3}]});
  const spec = {version: 1, project: 'Demo 项目', tagline: 'Explain before you install.', diagrams: [
    {type: 'overview', title: 'How it works', nodes: [node('input','输入文档'),node('process','生成图表'),node('output','得到结果')]},
    {type: 'architecture', title: 'Small by design', nodes: [node('ui','Interface'),node('cli','CLI'),node('core','Renderer')], edges: [{from:'ui',to:'core'}, {from:'cli',to:'core'}]},
    {type: 'quickstart', title: 'First result', nodes: [{...node('install','Install'), command:'node --version'}, {...node('run','Run'), command:'node scripts/cli.mjs --help'}]}
  ]};
  return {root, spec};
};

test('accepts three source-backed diagrams and captures evidence', async () => {
  const {root,spec}=await fixture(); const report=await validate(spec,root);
  assert.equal(report.evidence.length,8); assert.match(report.evidence[0].excerpt, /# Demo/);
});
for (const [name,change,error] of [
  ['version',s=>s.version=2,/version/],
  ['missing diagram',s=>s.diagrams.pop(),/three/],
  ['duplicate types',s=>s.diagrams[1].type='overview',/types/],
  ['unknown type',s=>s.diagrams[1].type='magic',/types/],
  ['duplicate ids',s=>s.diagrams[0].nodes[1].id='input',/unique/],
  ['no evidence',s=>s.diagrams[0].nodes[0].evidence=[],/evidence/],
  ['path traversal',s=>s.diagrams[0].nodes[0].evidence[0].path='../secret',/relative|inside/],
  ['absolute path',s=>s.diagrams[0].nodes[0].evidence[0].path='C:/secret',/relative/],
  ['backslash path',s=>s.diagrams[0].nodes[0].evidence[0].path='..\\secret',/relative/],
  ['missing evidence file',s=>s.diagrams[0].nodes[0].evidence[0].path='missing.md',/evidence/],
  ['bad line range',s=>s.diagrams[0].nodes[0].evidence[0].end=999,/line/],
  ['fractional line',s=>s.diagrams[0].nodes[0].evidence[0].start=1.5,/line/],
  ['long label',s=>s.diagrams[0].nodes[0].label='a'.repeat(65),/label/],
  ['xml control',s=>s.project='a\u0000b',/control/],
  ['dangling edge',s=>s.diagrams[1].edges[0].to='missing',/edge/],
  ['cycle',s=>s.diagrams[1].edges.push({from:'core',to:'ui'}),/cycle/],
  ['duplicate edge',s=>s.diagrams[1].edges.push({...s.diagrams[1].edges[0]}),/duplicate edge/],
  ['missing command',s=>delete s.diagrams[2].nodes[0].command,/command/],
  ['excess nodes',s=>s.diagrams[0].nodes=Array.from({length:7},(_,i)=>({...s.diagrams[0].nodes[0],id:`n${i}`})),/nodes/],
  ['unknown property',s=>s.diagrams[0].nodes[0].invented=true,/unknown/]
]) test(`rejects ${name}`,async()=>{const {root,spec}=await fixture();change(spec);await assert.rejects(()=>validate(spec,root),error);});

test('wraps CJK and long tokens without losing characters',()=>{
  const text='这是一个中文段落ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lines=wrapText(text,10);assert.equal(lines.join(''),text);assert.ok(lines.length>3);
});
test('renders all kinds deterministically, accessible and escaped in both themes',async()=>{
  const {spec}=await fixture();
  for(const d of spec.diagrams)for(const theme of ['light','dark']){
    const svg=renderSvg(spec,d,theme);assert.equal(svg,renderSvg(spec,d,theme));
    assert.match(svg, /role="img"/);assert.match(svg, /viewBox="0 0 800 /);
    assert.match(svg,/&amp; editable &lt;diagram&gt;/);assert.ok(!svg.includes('<script'));
  }
});
test('shows uncertainty visibly instead of silently presenting it as fact',async()=>{
  const {spec}=await fixture();spec.diagrams[0].nodes[0].uncertainty='Human review needed';
  assert.match(renderSvg(spec,spec.diagrams[0],'light'),/Human review needed/);
});
test('HTML is offline and escapes project and command injection',async()=>{
  const {spec}=await fixture();spec.project='<script>alert(1)</script>';
  spec.diagrams[2].nodes[0].command='</textarea><script>alert(2)</script>';
  const html=renderPreview(spec,{evidence:[]});assert.ok(!html.includes('<script>alert'));
  assert.ok(!/src="https?:/.test(html));assert.match(html,/&lt;script&gt;/);
});
test('generates a complete bundle, preserves editable source and refuses overwrite',async()=>{
  const {spec,root}=await fixture();const out=path.join(root,'out');await generate(spec,root,out);
  const names=await readdir(out);assert.equal(names.filter(n=>n.endsWith('.svg')).length,6);
  for(const n of ['index.html','visuals.json','evidence.json','README-snippet.md'])assert.ok(names.includes(n));
  assert.deepEqual(JSON.parse(await readFile(path.join(out,'visuals.json'),'utf8')),spec);
  await assert.rejects(()=>generate(spec,root,out),/exist/);
});
test('invalid input never creates output',async()=>{
  const {spec,root}=await fixture();spec.diagrams=[];await assert.rejects(()=>generate(spec,root,path.join(root,'out')));
  assert.ok(!(await readdir(root)).includes('out'));
});
test('CLI supports help and readable validation failures',()=>{
  const cli=path.resolve('scripts/cli.mjs');
  const help=spawnSync(process.execPath,[cli,'--help'],{encoding:'utf8'});assert.equal(help.status,0);assert.match(help.stdout,/render/);
  const bad=spawnSync(process.execPath,[cli,'render'],{encoding:'utf8'});assert.notEqual(bad.status,0);assert.match(bad.stderr,/Usage|input/);
});
test('CLI validates and renders a manifest using explicit root',async()=>{
  const {spec,root}=await fixture();const file=path.join(root,'visuals.json');await writeFile(file,JSON.stringify(spec));
  for(const cmd of ['check','render']){
    const args=[path.resolve('scripts/cli.mjs'),cmd,file,'--root',root];if(cmd==='render')args.push('--out',path.join(root,'rendered'));
    const result=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  }
});


test('does not claim human review has already happened',async()=>{
 const {spec}=await fixture();assert.ok(!renderSvg(spec,spec.diagrams[0]).includes('HUMAN-REVIEWED'));
});
test('README headings cannot inject raw HTML',async()=>{
 const {spec}=await fixture();spec.diagrams[0].title='<script>bad()</script>';
 assert.ok(!snippet(spec).includes('<script>'));
});
test('rejects symlink escapes',async t=>{
 const {root,spec}=await fixture();const outside=await mkdtemp(path.join(os.tmpdir(),'rvk-outside-'));
 await writeFile(path.join(outside,'private.txt'),'one\ntwo\nthree');
 const {symlink}=await import('node:fs/promises');
 try{await symlink(outside,path.join(root,'linked'),process.platform==='win32'?'junction':'dir');}
 catch(e){if(e.code==='EPERM'){t.skip('symlink permissions unavailable');return;}throw e;}
 spec.diagrams[0].nodes[0].evidence[0].path='linked/private.txt';
 await assert.rejects(()=>validate(spec,root),/inside/);
});

test('wraps English at word boundaries when words fit',()=>{
 assert.deepEqual(wrapText('alpha beta gamma',12),['alpha beta ','gamma']);
});
test('long project names wrap in the SVG header',async()=>{
 const {spec}=await fixture();spec.project='项'.repeat(60);
 const svg=renderSvg(spec,spec.diagrams[0]);
 assert.ok(!svg.includes('>'+spec.project+' / OVERVIEW</text>'));
});

test('wide Latin glyphs get a conservative wrapping budget',()=>{
 assert.ok(wrapText('WWWWWW',6).every(line=>line.length<=3));
});

for(const kind of ['cli','web','library'])test(`checked-in ${kind} gallery is reproducible from source`,async()=>{
 const base=path.resolve(`examples/${kind}`);const spec=JSON.parse(await readFile(path.join(base,'visuals.json'),'utf8'));const report=await validate(spec,base);
 for(const d of spec.diagrams)for(const theme of ['light','dark'])assert.equal(await readFile(`docs/gallery/${kind}/${d.type}.${theme}.svg`,'utf8'),renderSvg(spec,d,theme));
 assert.equal(await readFile(`docs/gallery/${kind}/index.html`,'utf8'),renderPreview(spec,report));
});
test('Node CLI fixture really produces the documented links',()=>{
 const result=spawnSync(process.execPath,['examples/cli/main.mjs','examples/cli/sample.md'],{encoding:'utf8'});
 assert.equal(result.status,0);assert.deepEqual(JSON.parse(result.stdout),['https://example.com','https://example.org/docs']);
});
test('skill scripts run when copied away from the repository',async()=>{
 const {cp}=await import('node:fs/promises');const root=await mkdtemp(path.join(os.tmpdir(),'rvk-skill-'));
 await cp('scripts',path.join(root,'scripts'),{recursive:true});await cp('examples/cli',path.join(root,'example'),{recursive:true});
 const result=spawnSync(process.execPath,[path.join(root,'scripts/cli.mjs'),'render',path.join(root,'example/visuals.json'),'--root',path.join(root,'example'),'--out',path.join(root,'out')],{cwd:root,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.equal((await readdir(path.join(root,'out'))).length,10);
});
