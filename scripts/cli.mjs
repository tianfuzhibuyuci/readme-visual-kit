#!/usr/bin/env node
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {validate,generate} from './kit.mjs';
const usage=`README Visual Kit v0.1.0
Usage:
  node scripts/cli.mjs check <visuals.json> --root <project-directory>
  node scripts/cli.mjs render <visuals.json> --root <project-directory> --out <new-directory>

Node.js 22+ · No dependencies · No API calls · No project code execution
Output parent must exist. Existing output directories are never overwritten.
Evidence is checked for existence and line bounds, not semantic truth.
`;
async function main(){
  const args=process.argv.slice(2);if(args.length===1&&['--help','-h'].includes(args[0])){console.log(usage);return;}
  const [cmd,input,...rest]=args;if(!['check','render'].includes(cmd)||!input||input.startsWith('--'))throw new Error(usage);
  const options={};for(let i=0;i<rest.length;i+=2){const key=rest[i];if(!['--root','--out'].includes(key)||!rest[i+1]||rest[i+1].startsWith('--')||options[key])throw new Error('Invalid or duplicate option.\n'+usage);options[key]=rest[i+1];}
  if(!options['--root']||(cmd==='render'&&!options['--out'])||(cmd==='check'&&options['--out']))throw new Error(usage);
  const info=await stat(input);if(!info.isFile()||info.size>256*1024)throw new Error('input must be a JSON file <= 256 KiB');
  const spec=JSON.parse((await readFile(input,'utf8')).replace(/^\uFEFF/,''));
  if(cmd==='check'){const report=await validate(spec,options['--root']);console.log(`OK: 3 diagrams, ${report.evidence.length} source ranges checked. Human semantic review still required.`);}
  else {const result=await generate(spec,options['--root'],path.resolve(options['--out']));console.log(`Created ${result.files.length} files in ${path.resolve(options['--out'])}\nOpen index.html locally. Review evidence.json before publishing.`);}
}
main().catch(error=>{console.error(`Error: ${error.message}`);process.exitCode=1;});
