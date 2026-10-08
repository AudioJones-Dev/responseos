import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(path.join(directory,item.name)):[path.join(directory,item.name)]);}

// Without output: "standalone" the deployable package is defined by the build's .nft.json traces
// (what Vercel bundles), plus required-server-files.json `files` and the traced entry files themselves.
export function tracedFiles(checkout){
 const next=path.join(checkout,'.next'),required=JSON.parse(fs.readFileSync(path.join(next,'required-server-files.json'),'utf8'));
 const traces=walk(next).filter(file=>file.endsWith('.nft.json')&&!path.relative(next,file).startsWith('cache'));
 const candidates=new Set(required.files.map(file=>path.resolve(checkout,file)));
 for(const trace of traces){candidates.add(trace);candidates.add(trace.slice(0,-'.nft.json'.length));for(const entry of JSON.parse(fs.readFileSync(trace,'utf8')).files)candidates.add(path.resolve(path.dirname(trace),entry));}
 const files=[],links=[],outside=[];
 for(const file of candidates){
  const relative=path.relative(checkout,file).replaceAll('\\','/');
  if(relative.startsWith('../')||path.isAbsolute(relative)){outside.push(file);continue;}
  if(!fs.existsSync(file))continue;
  if(fs.lstatSync(file).isSymbolicLink())links.push({file:relative,target:fs.readlinkSync(file)});
  else if(fs.statSync(file).isFile())files.push(relative);
 }
 if(outside.length)throw new Error('Traced files outside the checkout need explicit review: '+outside.slice(0,5).join(', '));
 return {traceFiles:traces.length,files:files.sort(),links};
}

// Hook events whose module file is inside the runtime root but outside the traced package.
export function untracedLoads(events,runtime,traced){
 const allowed=new Set(traced.files);
 return events.flatMap(item=>{
  const file=item.kind==='cjs-resolve'&&path.isAbsolute(item.file)?item.file:item.kind==='esm-resolve'&&item.url.startsWith('file:')?fileURLToPath(item.url):null;
  if(!file)return [];
  const relative=path.relative(runtime,path.resolve(file)).replaceAll('\\','/');
  return allowed.has(relative)||relative.startsWith('.next/static/')||relative.startsWith('public/')?[]:[{time:item.time,file:relative}];
 });
}

// Files the `next start` launcher loads while initializing, outside the traced request path (Next 16.3.4).
// Any other untraced load fails; these are excused only before the warm-up response. Recheck after Next upgrades.
const launcherDirectories=/^node_modules\/(next\/dist\/(bin|cli|build|lib|compiled|trace|telemetry)\/|@next\/swc-[^/]+\/)/;
const launcherFiles=new Set(['node_modules/next/dist/server/next.js','node_modules/next/dist/shared/lib/dset.js','node_modules/next/dist/shared/lib/errors/hard-deprecated-config-error.js','node_modules/next/dist/shared/lib/normalized-asset-prefix.js','node_modules/next/dist/shared/lib/zod.js']);
export const launcherFile=file=>launcherDirectories.test(file)||launcherFiles.has(file);
