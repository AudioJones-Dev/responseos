import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export function probeNative(root,env,directory,name='native'){
 fs.mkdirSync(directory,{recursive:true});const log=path.join(directory,name+'-loads.jsonl');fs.writeFileSync(log,'');
 const code='import {createRequire} from "node:module";const r=createRequire('+JSON.stringify(path.join(root,'package.json'))+');const result={platform:process.platform,arch:process.arch,nativeSucceeded:false};try{const lib=r("./node_modules/sharp/dist/libvips.cjs");result.runtimePlatform=lib.runtimePlatformArch();const sharp=r("sharp");const png=await sharp({create:{width:1,height:1,channels:3,background:{r:0,g:0,b:0}}}).png().toBuffer();result.pngBytes=png.length;result.nativeSucceeded=true;}catch(error){result.error=error.message;console.error(error.stack);process.exitCode=1;}console.log(JSON.stringify(result));';
 const result=spawnSync(process.execPath,['--import',pathToFileURL(path.resolve('scripts/security/braces-runtime-preload.mjs')).href,'--input-type=module','--eval',code],{cwd:root,env:{...env,RESPONSEOS_PROBE_ROOT:root,RESPONSEOS_PROBE_LOG:log},encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:1000000});
 fs.writeFileSync(path.join(directory,name+'-probe.log'),(result.stdout||'')+(result.stderr||''));
 let observation={nativeSucceeded:false,error:result.error?.message||'Missing native observation'};try{observation=JSON.parse(result.stdout.trim());}catch{}
 const events=fs.readFileSync(log,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line));
 const summary={exit:result.status,observation,eventCount:events.length,escapes:events.filter(row=>row.kind==='escape-blocked'),scope:'Synthetic one-pixel image control with module containment; not production request coverage'};
 fs.writeFileSync(path.join(directory,name+'-summary.json'),JSON.stringify(summary,null,2)+'\n');
 return {...summary,events};
}
