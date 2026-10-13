import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const root=process.cwd();
const evidence=path.join(root,'.security-evidence/artifact-verification');
const build=JSON.parse(fs.readFileSync(path.join(evidence,'build-summary.json')));
if(!build.buildSucceeded) throw new Error('Fresh build must succeed before artifact conclusions');
const checkout=build.checkout;
const load=createRequire(path.join(checkout,'package.json'));
const ts=load('typescript');
import {targets,signals,references} from './braces-artifact-analysis.mjs';
import {tracedFiles} from './braces-traced-runtime.mjs';
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
function walk(directory){
 const files=[];
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);
  if(entry.isSymbolicLink()) {files.push({file,link:fs.readlinkSync(file),resolved:fs.realpathSync(file)});continue;}
  if(entry.isDirectory()) files.push(...walk(file));else files.push({file});
 }
 return files;
}
const inventory=[],hits=[],traces=[],imports=[],packages=[],links=[];
const standalone=fs.existsSync(path.join(checkout,'.next/standalone'));
const outsideNext=standalone?[]:tracedFiles(checkout).files.filter(file=>!file.startsWith('.next/')).map(file=>({file:path.join(checkout,file)}));
for(const item of [...walk(path.join(checkout,'.next')),...outsideNext].sort((a,b)=>a.file.localeCompare(b.file))){
 const relative=path.relative(checkout,item.file).replaceAll('\\','/');
 if(relative.startsWith('.next/cache/')) continue;
 if(item.link){links.push({...item,file:relative});continue;}
 const data=fs.readFileSync(item.file);
 inventory.push({file:relative,bytes:data.length,sha256:sha(data)});
 if(!/\.(js|mjs|cjs|json|map)$/.test(relative)) continue;
 const text=data.toString('utf8');
 const found=signals(text);
 if(found.names.length||found.implementation.length) hits.push({file:relative,...found});
 if(relative.endsWith('.nft.json')){
  const trace=JSON.parse(text);
  for(const entry of trace.files||[]){
   const resolved=path.resolve(path.dirname(item.file),entry);
   traces.push({trace:relative,entry,exists:fs.existsSync(resolved),affected:targets.some(name=>resolved.replaceAll('\\','/').includes('/node_modules/'+name+'/'))});
  }
 }
 if(path.basename(relative)==='package.json'){
  try{const pkg=JSON.parse(text);packages.push({file:relative,name:pkg.name,version:pkg.version,dependencies:pkg.dependencies||{},affected:targets.includes(pkg.name)});}catch{}
 }
 if(!/\.(js|mjs|cjs)$/.test(relative)) continue;
 for(const reference of references(ts,relative,text)){
  let resolution='computed-unknown';
  if(reference.literal){
   if(reference.input.startsWith('.')||path.isAbsolute(reference.input))resolution='relative-or-absolute';
   else {try{resolution=createRequire(item.file).resolve(reference.input);}catch{resolution='unresolved-external';}}
  }
  imports.push({file:relative,...reference,resolution});
 }
}
const manifestFiles=inventory.filter(item=>/manifest|BUILD_ID|server\.js$|next-server\.js\.nft/.test(item.file));
const result={capturedAt:new Date().toISOString(),sourceCommit:build.sourceCommit,scope:standalone?'fresh local Windows .next output, cache excluded; public source copied at runtime':'fresh .next output plus traced files outside .next, cache excluded',inventoryCount:inventory.length,manifestFiles,hits,packages,links,traceEntries:traces.length,missingTraceEntries:traces.filter(item=>!item.exists),affectedTraceEntries:traces.filter(item=>item.affected),importCount:imports.length,computedImportCount:imports.filter(item=>!item.literal).length,unresolvedExternalCount:imports.filter(item=>item.resolution==='unresolved-external').length,limitations:['Name/fingerprint scans are heuristic, not exhaustive embedded-code recognition','AST scan covers require()/import() expressions; bundled custom loaders and aliases remain possible','Computed imports require review; no universal absence conclusion','Trace paths represent build checkout, not proof of standalone resolution']};
for(const [name,value] of Object.entries({inventory,imports,traces,'inspection-summary':result})) fs.writeFileSync(path.join(evidence,name+'.json'),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({inventoryCount:inventory.length,traceEntries:traces.length,hits:hits.slice(0,20),affectedPackages:packages.filter(item=>item.affected),affectedTraceEntries:result.affectedTraceEntries.length,missingTraceEntries:result.missingTraceEntries.length,computedImportCount:result.computedImportCount,unresolvedExternalCount:result.unresolvedExternalCount,links:links.length},null,2));
