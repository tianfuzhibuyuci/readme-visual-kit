import {readFile, stat, realpath, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

export const TYPES = ['overview', 'architecture', 'quickstart'];
const fail = message => {throw new Error(message);};
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function keys(value, allowed, at) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${at}: expected object`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${at}: unknown property ${key}`);
}
function text(value, max, at, optional=false) {
  if(optional && value === undefined) return;
  if(typeof value !== 'string' || !value.trim() || [...value].length > max) fail(`${at}: expected nonempty text, max ${max} characters`);
  if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u202a-\u202e\u2066-\u2069]/u.test(value) || !value.isWellFormed()) fail(`${at}: invalid control characters`);
}
function layers(diagram) {
  const remaining=new Set(diagram.nodes.map(n=>n.id)); const result=[];
  while(remaining.size) {
    const layer=diagram.nodes.filter(n=>remaining.has(n.id) && !diagram.edges.some(e=>e.to===n.id && remaining.has(e.from)));
    if(!layer.length) fail('architecture: cycle detected; simplify loops before rendering');
    result.push(layer);layer.forEach(n=>remaining.delete(n.id));
  }
  return result;
}
export async function validate(spec, root) {
  keys(spec,['version','project','tagline','diagrams'],'manifest');
  if(spec.version!==1) fail('version must be 1');
  text(spec.project,60,'project');text(spec.tagline,120,'tagline');
  if(!Array.isArray(spec.diagrams)||spec.diagrams.length!==3) fail('exactly three diagrams required');
  if(new Set(spec.diagrams.map(d=>d?.type)).size!==3 || spec.diagrams.some(d=>!TYPES.includes(d?.type))) fail('diagram types must be overview, architecture, quickstart');
  const base=await realpath(root);const evidence=[];const cache=new Map();
  for(const d of spec.diagrams) {
    keys(d,['type','title','nodes',...(d.type==='architecture'?['edges']:[])],'diagram');
    text(d.title,64,'diagram.title');
    if(!Array.isArray(d.nodes)||d.nodes.length<2||d.nodes.length>6) fail(`${d.type}: nodes must contain 2 to 6 entries`);
    const ids=new Set();
    for(const n of d.nodes) {
      keys(n,['id','label','detail','evidence','uncertainty',...(d.type==='quickstart'?['command']:[])],'node');
      if(typeof n.id!=='string'|| !/^[a-z][a-z0-9-]{0,31}$/.test(n.id)||ids.has(n.id)) fail('node ids must be unique lowercase slugs');
      ids.add(n.id);text(n.label,64,'node.label');text(n.detail,180,'node.detail');text(n.uncertainty,100,'node.uncertainty',true);
      if(d.type==='quickstart')text(n.command,240,'node.command');
      if(!Array.isArray(n.evidence)||!n.evidence.length||n.evidence.length>4) fail('node.evidence needs 1 to 4 source ranges');
      for(const e of n.evidence) {
        keys(e,['path','start','end'],'evidence');text(e.path,240,'evidence.path');
        if(/[:\\\x00-\x1f]/.test(e.path)||e.path.startsWith('/')||e.path.split('/').some(p=>p==='..'||p==='.'||!p)) fail('evidence path must be a safe relative POSIX path inside the project');
        if(!Number.isInteger(e.start)||!Number.isInteger(e.end)||e.start<1||e.end<e.start||e.end-e.start>79)fail('evidence line range must be 1-based, at most 80 lines');
        if(!cache.has(e.path)) {
          let resolved, info;
          try {resolved=await realpath(path.join(base,e.path));info=await stat(resolved);} catch {fail(`evidence file missing: ${e.path}`);}
          const rel=path.relative(base,resolved);
          if(rel.startsWith('..'+path.sep)||rel==='..'||path.isAbsolute(rel))fail('evidence must stay inside project root (including symlinks)');
          if(!info.isFile()||info.size>1024*1024)fail(`evidence must be a text file <= 1 MiB: ${e.path}`);
          const raw=await readFile(resolved);let content;
          try {content=new TextDecoder('utf-8',{fatal:true}).decode(raw);}catch {fail(`evidence is not UTF-8: ${e.path}`);}
          if(content.includes('\0'))fail(`evidence is not text: ${e.path}`);
          const lines=content.replace(/\r\n/g,'\n').split('\n');if(lines.at(-1)==='')lines.pop();cache.set(e.path,lines);
        }
        const lines=cache.get(e.path);if(e.end>lines.length)fail(`evidence line range exceeds ${e.path} (${lines.length} lines)`);
        const excerpt=lines.slice(e.start-1,e.end).join('\n');
        if(excerpt.length>20000) fail(`evidence excerpt too large: ${e.path}`);
        evidence.push({diagram:d.type,node:n.id,...e,excerpt});
      }
    }
    if(d.type==='architecture') {
      if(!Array.isArray(d.edges)||!d.edges.length||d.edges.length>12)fail('architecture needs 1 to 12 edges');
      const seen=new Set();
      for(const e of d.edges) {
        keys(e,['from','to'],'edge');if(!ids.has(e.from)||!ids.has(e.to))fail('edge references unknown node');
        const k=`${e.from}:${e.to}`;if(seen.has(k))fail('duplicate edge');seen.add(k);
      }
      layers(d);
    }
  }
  return {version:1,notice:'References were checked for file existence and line bounds, not semantic truth. Excerpts may contain private information: review before publishing.',evidence};
}

// 使用保守字宽估计，不依赖浏览器或远程字体；保留每一个字符。
const glyphUnits=ch=>ch.codePointAt(0)>255?2:/[WMwm@%]/.test(ch)?1.8:/[A-Z&]/.test(ch)?1.3:1;
export function wrapText(value, capacity) {
  const lines=[];let line='',used=0;
  for(const ch of String(value)) {
    if(ch==='\n'){lines.push(line);line='';used=0;continue;}
    const units=glyphUnits(ch);
    if(used+units>capacity && line){
      const boundary=line.lastIndexOf(' ');
      if(boundary>0){lines.push(line.slice(0,boundary+1));line=line.slice(boundary+1);used=[...line].reduce((sum,c)=>sum+glyphUnits(c),0);}
      else {lines.push(line);line='';used=0;}
    }
    line+=ch;used+=units;
  }
  if(line||!lines.length)lines.push(line);
  return lines;
}
const palettes={
  light:{bg:'#f7f8fc',card:'#ffffff',ink:'#17243b',muted:'#58677d',line:'#c9d3e2',accent:'#2058c9',soft:'#eaf0ff',code:'#eff3fa',warn:'#925100'},
  dark:{bg:'#101827',card:'#1b273a',ink:'#f1f5fd',muted:'#b3bfd2',line:'#52637d',accent:'#8eb4ff',soft:'#243756',code:'#111d2f',warn:'#ffd186'}
};
function block(value,x,y,width,size,color,weight=400,mono=false) {
  const lines=wrapText(value,Math.floor(width/(size*0.66)));
  return {height:lines.length*size*1.4,svg:lines.map((line,i)=>`<text x="${x}" y="${y+i*size*1.4}" font-size="${size}" font-weight="${weight}" fill="${color}"${mono?' font-family="ui-monospace, Consolas, monospace"':''}>${esc(line)}</text>`).join('')};
}
function card(n,x,y,w,p,index,type) {
  const pad=24;const title=block(n.label,x+pad,y+66,w-pad*2,27,p.ink,650);
  let cursor=y+66+title.height+5;
  const detail=block(n.detail,x+pad,cursor,w-pad*2,22,p.muted);cursor+=detail.height;
  let body=title.svg+detail.svg;
  if(type==='quickstart') {
    cursor+=10;const command=block(n.command,x+pad+14,cursor+28,w-pad*2-28,20,p.ink,400,true);
    body+=`<rect x="${x+pad}" y="${cursor}" width="${w-pad*2}" height="${command.height+24}" rx="10" fill="${p.code}"/>${command.svg}`;
    cursor+=command.height+42;
  }
  if(n.uncertainty){const note=block(`? ${n.uncertainty}`,x+pad,cursor+6,w-pad*2,18,p.warn);body+=note.svg;cursor+=note.height+12;}
  const h=Math.ceil(cursor-y+20);
  return {x,y,w,h,svg:`<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${p.card}" stroke="${p.line}"/><text x="${x+pad}" y="${y+30}" fill="${p.accent}" font-size="15" font-weight="700" letter-spacing="2">${String(index+1).padStart(2,'0')} / ${type==='quickstart'?'STEP':type==='architecture'?'COMPONENT':'FLOW'}</text>${body}</g>`};
}
export function renderSvg(spec,d,theme='light') {
  const p=palettes[theme];if(!p)fail('unknown theme');
  const header=block(spec.project+' / '+d.type.toUpperCase(),58,48,702,16,p.accent,700);
  const titleY=85+header.height;
  const title=block(d.title,40,titleY,720,38,p.ink,700);
  const sub=block(spec.tagline,40,titleY+title.height+4,720,21,p.muted);
  let y=Math.ceil(titleY+title.height+sub.height+40);const cards=[];const positions=new Map();
  const rows=d.type==='architecture'?layers(d).flatMap(group=>{const a=[];for(let i=0;i<group.length;i+=2)a.push(group.slice(i,i+2));return a;}):d.nodes.map(n=>[n]);
  for(const row of rows) {
    let maxH=0;
    row.forEach((n,i)=>{
      const w=row.length===1?720:344;const x=row.length===1?40:40+i*376;
      const c=card(n,x,y,w,p,d.nodes.indexOf(n),d.type);cards.push(c);positions.set(n.id,c);maxH=Math.max(maxH,c.h);
    });y+=maxH+58;
  }
  const edges=d.type==='architecture'?d.edges:d.nodes.slice(1).map((n,i)=>({from:d.nodes[i].id,to:n.id}));
  const paths=edges.map(e=>{
    const a=positions.get(e.from),b=positions.get(e.to);const x1=a.x+a.w/2,y1=a.y+a.h,x2=b.x+b.w/2,y2=b.y-9;
    // 跨层连接绕过中间节点，避免线条被卡片内容覆盖。
    if(b.y>a.y+a.h+90){const lane=24;return `<path d="M ${x1} ${y1} V ${y1+18} H ${lane} V ${y2-18} H ${x2} V ${y2}"/>`;}
    return `<path d="M ${x1} ${y1} C ${x1} ${y1+28}, ${x2} ${y2-28}, ${x2} ${y2}"/>`;
  }).join('');
  const height=y+24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${height}" viewBox="0 0 800 ${height}" role="img" aria-labelledby="title desc">
<title id="title">${esc(spec.project)} — ${esc(d.title)}</title><desc id="desc">${esc(d.nodes.map(n=>n.label+': '+n.detail+(n.command?' — '+n.command:'')+(n.uncertainty?' — Unconfirmed: '+n.uncertainty:'')).join('. '))}</desc>
<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M 0 0 L 7 4 L 0 8" fill="none" stroke="${p.line}" stroke-width="1.5"/></marker></defs>
<rect width="800" height="${height}" rx="24" fill="${p.bg}"/>
<g font-family="system-ui, -apple-system, Segoe UI, Microsoft YaHei, Noto Sans CJK SC, sans-serif">
<rect x="40" y="32" width="6" height="20" rx="3" fill="${p.accent}"/>${header.svg}
${title.svg}${sub.svg}<g fill="none" stroke="${p.line}" stroke-width="2" marker-end="url(#arrow)">${paths}</g>${cards.map(c=>c.svg).join('')}
<text x="40" y="${height-26}" fill="${p.muted}" font-size="14">README VISUAL KIT · SOURCE-REFERENCED / REVIEW BEFORE PUBLISHING</text></g></svg>\n`;
}
export function snippet(spec,prefix='./') {
  return spec.diagrams.map(d=>`### ${esc(d.title).replace(/[\r\n]/g,' ')}\n\n<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="${prefix}${d.type}.dark.svg">\n  <img alt="${esc(spec.project+' — '+d.title)}" src="${prefix}${d.type}.light.svg" width="800">\n</picture>`).join('\n\n')+'\n';
}
export function renderPreview(spec,report) {
  const tabs=spec.diagrams.map((d,i)=>`<button type="button" class="tab" role="tab" id="tab-${d.type}" aria-selected="${i===0}" aria-controls="panel-${d.type}" data-tab="${d.type}">${['01','02','03'][i]} &nbsp; ${esc(d.type)}</button>`).join('');
  const panels=spec.diagrams.map((d,i)=>`<section class="panel" id="panel-${d.type}" role="tabpanel" aria-labelledby="tab-${d.type}" ${i?'hidden':''}><div class="panel-head"><div><span class="eyebrow">${esc(d.type)}</span><h2>${esc(d.title)}</h2></div><a class="download" href="${d.type}.light.svg" download data-download="${d.type}">Download SVG ↓</a></div><p class="swipe-note">Swipe diagram ↔ / 左右滑动查看完整图表</p><div class="canvas"><img class="diagram" src="${d.type}.light.svg" alt="${esc(d.title)}" data-diagram="${d.type}"></div></section>`).join('');
  const refs=report.evidence.map(e=>`<details><summary>${esc(e.diagram)} / ${esc(e.node)} <span>${esc(e.path)}:${e.start}–${e.end}</span></summary><pre>${esc(e.excerpt)}</pre></details>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${esc(spec.project)} · README Visual Kit</title><style>
:root{--bg:#f5f6fa;--card:#fff;--ink:#17243b;--muted:#58677d;--line:#d8dfeb;--accent:#2058c9;--soft:#eaf0ff;color-scheme:light}html[data-theme=dark]{--bg:#101827;--card:#1b273a;--ink:#f1f5fd;--muted:#b3bfd2;--line:#52637d;--accent:#8eb4ff;--soft:#243756;color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,'Segoe UI','Microsoft YaHei',sans-serif}button,a,textarea{font:inherit}button,a{touch-action:manipulation}button{cursor:pointer}button:focus-visible,a:focus-visible,summary:focus-visible,textarea:focus-visible{outline:3px solid var(--accent);outline-offset:4px}[hidden]{display:none!important}.shell{max-width:1200px;margin:auto;padding:28px 40px 64px}header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:24px;border-bottom:1px solid var(--line)}.brand{font-size:14px;font-weight:750;letter-spacing:1px}.mark{display:inline-grid;place-items:center;background:var(--accent);color:var(--bg);width:29px;height:29px;border-radius:7px;margin-right:10px}.theme,.copy{background:var(--card);border:1px solid var(--line);border-radius:9px;color:var(--ink);padding:9px 13px}.hero{padding:46px 0 32px}.eyebrow{text-transform:uppercase;font-size:11px;letter-spacing:2px;color:var(--accent);font-weight:750}.hero h1{font-size:clamp(32px,5vw,56px);line-height:1.08;letter-spacing:-2px;margin:16px 0;max-width:850px;overflow-wrap:anywhere}.hero p{color:var(--muted);font-size:17px;line-height:1.7;max-width:650px}.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{font-size:12px;border:1px solid var(--line);padding:6px 10px;border-radius:99px;color:var(--muted)}.workspace{display:grid;grid-template-columns:220px minmax(0,1fr);gap:24px;align-items:start}.workspace>div{min-width:0}nav{min-width:0;display:grid;gap:8px;position:sticky;top:20px}.tab{text-align:left;border:1px solid transparent;border-radius:10px;padding:15px;color:var(--muted);background:transparent;text-transform:capitalize}.tab[aria-selected=true]{border-color:var(--line);background:var(--card);color:var(--accent);font-weight:650}.sidebar-note{font-size:12px;line-height:1.8;color:var(--muted);padding:8px 14px}.panel{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden}.panel-head{padding:22px 24px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px}h2{margin:6px 0 0;font-size:20px}.download{font-size:13px;color:var(--accent);text-decoration:none;white-space:nowrap}.swipe-note{display:none}.canvas{padding:18px;background:var(--bg);overflow:auto}.diagram{display:block;width:100%;height:auto}.support{margin-top:24px;border:1px solid var(--line);border-radius:14px;padding:24px;background:var(--card)}.support p{color:var(--muted);font-size:14px;line-height:1.7}.support a{color:var(--accent)}.support h2{font-size:18px}textarea{width:100%;min-height:165px;margin:15px 0;padding:14px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;font-family:ui-monospace,Consolas,monospace;font-size:12px;resize:vertical}details{border-top:1px solid var(--line);padding:12px 0;font-size:13px}summary{cursor:pointer;line-height:1.7;overflow-wrap:anywhere}summary span{color:var(--muted)}pre{background:var(--bg);padding:14px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.footer{margin-top:32px;color:var(--muted);font-size:12px}#status{font-size:12px;padding-left:12px;color:var(--muted)}@media(max-width:700px){.shell{padding:20px 16px}.hero{padding:30px 0 24px}.workspace{grid-template-columns:minmax(0,1fr);gap:12px}nav{position:static;grid-template-columns:repeat(3,1fr);gap:4px}.tab{font-size:12px;padding:12px 6px;text-align:center}.sidebar-note{display:none}.panel-head{padding:16px;align-items:start;flex-direction:column}.swipe-note{display:block;margin:0;padding:10px 16px;color:var(--muted);font-size:11px;background:var(--bg)}.canvas{padding:8px}.diagram{min-width:540px}.support{padding:18px}.brand{font-size:11px}.hero h1{letter-spacing:-1px}}
</style></head><body><div class="shell"><header><div class="brand"><span class="mark">▥</span> README VISUAL KIT</div><button class="theme" type="button" aria-label="Toggle dark theme" aria-pressed="false">Dark mode ◐</button></header><div class="hero"><span class="eyebrow">Less explaining. More understanding.</span><h1>${esc(spec.project)}<br>At a glance.</h1><p>${esc(spec.tagline)}</p><div class="chips"><span class="chip">3 focused diagrams</span><span class="chip">Editable JSON + SVG</span><span class="chip">Local · No API key</span></div></div><main><div class="workspace"><nav role="tablist" aria-label="Diagram type">${tabs}<p class="sidebar-note">Explain the value.<br>Show the moving parts.<br>Make the first run obvious.<br><br>On mobile, swipe the diagram to inspect it at a readable size.</p></nav><div>${panels}<section class="support"><h2>Put it in your README</h2><p>These paths assume your README is beside the SVGs. Adjust the prefix when copying into your repository.</p><textarea id="snippet" aria-label="README embed snippet" readonly>${esc(snippet(spec))}</textarea><button class="copy" type="button">Copy snippet</button><span id="status" role="status" aria-live="polite"></span><p><a href="visuals.json" download>Editable source JSON ↓</a> &nbsp;·&nbsp; <a href="evidence.json" download>Evidence report ↓</a></p></section><section class="support"><h2>Sources, not assumptions</h2><p>File paths and line ranges were checked. This does not verify meaning or architecture edges. Review all claims and excerpts before publishing; excerpts may contain private data.</p>${refs}</section></div></div></main><div class="footer">Built with README Visual Kit · No external requests · SVGs remain usable without this page.</div></div><script>
const root=document.documentElement;const toggle=document.querySelector('.theme');
function setTheme(dark){root.dataset.theme=dark?'dark':'light';toggle.setAttribute('aria-pressed',String(dark));toggle.textContent=dark?'Light mode ◑':'Dark mode ◐';document.querySelectorAll('[data-diagram]').forEach(img=>img.src=img.dataset.diagram+'.'+(dark?'dark':'light')+'.svg');document.querySelectorAll('[data-download]').forEach(a=>a.href=a.dataset.download+'.'+(dark?'dark':'light')+'.svg');}
setTheme(matchMedia('(prefers-color-scheme: dark)').matches);toggle.addEventListener('click',()=>setTheme(root.dataset.theme!=='dark'));
const tabs=[...document.querySelectorAll('[data-tab]')];function select(tab){tabs.forEach(t=>{t.setAttribute('aria-selected',String(t===tab));t.tabIndex=t===tab?0:-1;});document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!=='panel-'+tab.dataset.tab);}
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>select(tab));tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(i+1)%tabs.length;else if(event.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();select(tabs[next]);tabs[next].focus();});});select(tabs[0]);
document.querySelector('.copy').addEventListener('click',async()=>{const input=document.querySelector('#snippet');input.focus();input.select();try{await navigator.clipboard.writeText(input.value);document.querySelector('#status').textContent='Copied.';}catch{document.querySelector('#status').textContent='Selected. Press Ctrl+C / Cmd+C to copy.';}});
</script></body></html>`;
}
export async function generate(spec,root,out) {
  const report=await validate(spec,root);
  // 先完成渲染再创建目录；不覆盖任何已有目录或文件。
  const files=new Map();for(const d of spec.diagrams)for(const theme of ['light','dark'])files.set(`${d.type}.${theme}.svg`,renderSvg(spec,d,theme));
  files.set('visuals.json',JSON.stringify(spec,null,2)+'\n');files.set('evidence.json',JSON.stringify(report,null,2)+'\n');files.set('README-snippet.md',snippet(spec));files.set('index.html',renderPreview(spec,report));
  try{await mkdir(out);}catch(e){if(e.code==='EEXIST')fail('Output already exists. Choose a new output directory; no files were overwritten.');throw e;}
  for(const [name,content] of files)await writeFile(path.join(out,name),content,{encoding:'utf8',flag:'wx'});
  return {files:[...files.keys()],report};
}
