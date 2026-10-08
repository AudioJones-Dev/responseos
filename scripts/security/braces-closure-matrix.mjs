import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {probeNative} from './braces-native-probe.mjs';
import {pathToFileURL} from 'node:url';
import {references} from './braces-artifact-analysis.mjs';
import {verifyBundle,toolingHash} from './braces-ci-accept.mjs';
const evidence=path.resolve(process.argv[2]||'.security-tools/archive-verification'),output=path.resolve(process.argv[3]||'.security-evidence/closure-review');
const read=name=>JSON.parse(fs.readFileSync(path.join(evidence,name),'utf8')),hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const archive='docs/security/packaging-proposal-evidence/raw-evidence.tar.gz',archiveManifest=JSON.parse(fs.readFileSync('docs/security/packaging-proposal-evidence/archive.json'));
if(hash(fs.readFileSync(archive))!==archiveManifest.sha256)throw new Error('Preserved archive hash mismatch');
const report=verifyBundle(evidence),build=read('artifact-verification/build-summary.json'),original=JSON.parse(fs.readFileSync('docs/security/packaging-proposal-evidence/artifact-verification/closure-ledger.json','utf8')),inventory=read('artifact-verification/inventory.json'),before=read('artifact-verification/runtime-before.json'),runtime=read('artifact-verification/runtime-summary.json');
if(build.sourceCommit!=='4e1f353117696658988bca171e4e0e51c0fb1b96'||build.platform!=='win32'||process.version!==build.node||original.ledger.length!==140||original.ledger.some((row,index)=>row.id!==index+1))throw new Error('Frozen occurrence identity mismatch');
const checkout=build.checkout,ts=createRequire(path.join(checkout,'package.json'))('typescript');
const inventoryMap=new Map(inventory.map(row=>[row.file,row])),runtimeMap=new Map(before.map(row=>[row.file,row]));
const events=fs.readFileSync(path.join(evidence,'artifact-verification/runtime-loads.jsonl'),'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line));
fs.mkdirSync(output,{recursive:true});
const native=probeNative(runtime.runtime,build.env,output),nativeProof=native.observation,nativeEvents=native.events;
const installed=probeNative(build.checkout,build.env,output,'installed-native');
const nativeFolder='node_modules/@img/sharp-win32-x64/lib';
const missingPackagedFiles=fs.readdirSync(path.join(build.checkout,nativeFolder)).filter(name=>!runtimeMap.has(nativeFolder+'/'+name)).map(name=>({file:nativeFolder+'/'+name,sourceSha256:hash(fs.readFileSync(path.join(build.checkout,nativeFolder,name))),packaged:false}));
fs.writeFileSync(path.join(output,'native-packaging-comparison.json'),JSON.stringify({applicationSha:build.sourceCommit,node:process.version,installedProbeExit:installed.exit,installedObservation:installed.observation,missingPackagedFiles,scope:'Original inspected package unchanged; no DLL copied'},null,2)+'\n');
if(nativeProof.platform!=='win32'||nativeProof.arch!=='x64'||nativeProof.runtimePlatform!=='win32-x64'||nativeEvents.some(row=>row.kind==='escape-blocked'))throw new Error('Unsupported native platform control');
const selectedNative=[...new Set(nativeEvents.filter(row=>row.kind==='cjs-resolve'&&row.file?.endsWith('.node')).map(row=>row.file))].map(file=>{
 const relative=path.relative(runtime.runtime,file).replaceAll('\\','/'),item=runtimeMap.get(relative);
 if(!item||hash(fs.readFileSync(file))!==item.sha256)throw new Error('Selected native target hash mismatch');
 return {file:relative,sha256:item.sha256,resolutionObserved:true,nativeOperationSucceeded:nativeProof.nativeSucceeded};
});
if(!selectedNative.some(row=>row.file.includes('@img/sharp-win32-x64/')))throw new Error('Selected native target not observed');
const cache=new Map();
function source(file){
 if(!cache.has(file)){
  const text=fs.readFileSync(path.join(checkout,file),'utf8'),item=inventoryMap.get(file);
  if(!item||hash(text)!==item.sha256)throw new Error('Artifact source hash mismatch: '+file);
  cache.set(file,{text,hash:item.sha256,refs:references(ts,file,text),used:new Set()});
 }return cache.get(file);
}
const helperFiles=['.next/standalone/node_modules/sharp/dist/libvips.cjs','.next/standalone/node_modules/sharp/dist/libvips.mjs'];
const helperProof=helperFiles.map(file=>{const entry=source(file);return {file,sha256:entry.hash,supported:entry.text.includes('const runtimePlatformArch = () => '+String.fromCharCode(96)+'\u0024{process.platform}\u0024{runtimeLibc()}-\u0024{process.arch}'+String.fromCharCode(96)+';')};});
if(helperProof.some(row=>!row.supported))throw new Error('Native selector source requires new review');
const matrix=original.ledger.map(row=>{
 const entry=source(row.file);if(entry.hash!==row.evidence.sourceHash)throw new Error('Occurrence source hash mismatch: '+row.id);
 const found=entry.refs.findIndex((ref,index)=>!entry.used.has(index)&&ref.line===row.evidence.line&&ref.input===row.evidence.input&&ref.context===row.evidence.context);
 if(found<0)throw new Error('Occurrence no longer matches AST: '+row.id);entry.used.add(found);const ref=entry.refs[found];
 const relative=row.file.startsWith('.next/standalone/')?row.file.slice('.next/standalone/'.length):row.file,packaged=runtimeMap.get(relative);
 let scope=packaged?'PACKAGED_RUNTIME':'UNPACKAGED_OUTPUT',decision='UNKNOWN',proof=[],obligation=row.reason,duplicateOf=null;
 if(packaged){
  if(packaged.sha256!==entry.hash||hash(fs.readFileSync(path.join(runtime.runtime,relative)))!==entry.hash)throw new Error('Runtime copy hash mismatch: '+row.id);
  scope=row.file.startsWith('.next/standalone/')?'PACKAGED_RUNTIME':'DUPLICATED_RUNTIME_COPY';
  duplicateOf=original.ledger.find(other=>other.id!==row.id&&other.file==='.next/standalone/'+row.file&&other.evidence.sourceHash===entry.hash&&other.evidence.input===ref.input&&other.evidence.line===ref.line)?.id||null;
  proof.push({kind:'packaged-file',file:relative,sha256:packaged.sha256});
 }else if(row.file.startsWith('.next/build/')){
  scope='BUILD_ONLY_OUTPUT';decision='CLOSED_SOURCE_FILE_EXCLUDED';obligation='Reassess if deployment packaging includes build output; embedded equivalents remain a separate obligation';
  proof.push({kind:'runtime-inventory-exclusion',file:relative,inventory:'artifact-verification/runtime-before.json',inventorySha256:hash(fs.readFileSync(path.join(evidence,'artifact-verification/runtime-before.json')))});
 }
 const platformGuard=ref.guards.find(guard=>guard.kind==='switch-case'&&guard.discriminant==='runtimePlatform');
 if(packaged&&/^\.next\/standalone\/node_modules\/sharp\/dist\/sharp\.(cjs|mjs)$/.test(row.file)&&entry.text.includes('const runtimePlatform = runtimePlatformArch();')&&/case \"win32-x64\":\s*sharp = require\(\"@img\/sharp-win32-x64\/sharp\.node\"\);\s*break;/.test(entry.text)&&platformGuard&&!platformGuard.labels.includes('"win32-x64"')&&!platformGuard.labels.includes('default')){
  decision='CLOSED_INACTIVE_WINDOWS_BRANCH';obligation='Windows x64 selector only; Linux and other platforms require their own artifacts and selector proof';
  proof.push({kind:'inactive-platform-case',selected:nativeProof.runtimePlatform,cases:platformGuard.labels,selectorSources:helperProof,nativeTargets:selectedNative});
 }
 const loaded=events.some(event=>event.kind==='cjs-resolve'&&event.file===path.join(runtime.runtime,relative)||event.kind==='esm-resolve'&&event.url===pathToFileURL(path.join(runtime.runtime,relative)).href);
 return {id:row.id,applicationSha:build.sourceCommit,platform:'win32-x64',file:row.file,line:ref.line,column:ref.column,sourceHash:entry.hash,artifactScope:scope,duplicateOf,category:row.category,kind:ref.kind,input:ref.input,containingFunction:ref.containingFunction,guards:ref.guards,context:ref.context,proposedTarget:ref.literal?ref.input:'Requires computed target enumeration',decision,runtimeReachability:decision==='CLOSED_SOURCE_FILE_EXCLUDED'?'SOURCE_FILE_NOT_PACKAGED':decision==='CLOSED_INACTIVE_WINDOWS_BRANCH'?'INACTIVE_FOR_INSPECTED_PLATFORM':loaded?'MODULE_RESOLUTION_OBSERVED_CALL_SITE_UNPROVEN':'CALL_SITE_REACHABILITY_UNPROVEN',proof,remainingObligation:obligation};
});
const counts=field=>Object.fromEntries([...new Set(matrix.map(row=>row[field]))].map(value=>[value,matrix.filter(row=>row[field]===value).length]));
const summary={capturedAt:new Date().toISOString(),applicationSha:build.sourceCommit,toolHash:toolingHash(),platform:'win32-x64',occurrences:matrix.length,decisions:counts('decision'),artifactScopes:counts('artifactScope'),categories:counts('category'),duplicateRows:matrix.filter(row=>row.duplicateOf).length,overallPackagingClosure:nativeProof.nativeSucceeded?'UNKNOWN':'FAIL',nativeOperationSucceeded:nativeProof.nativeSucceeded,nativeFailure:nativeProof.error||null,auditFindings:report.auditTotal,taskFailures:report.compatibility.tasks.total-report.compatibility.tasks.pass,limitations:['Occurrence closure is scoped to the inspected materialized Windows package, not every deployment','All 140 original IDs are retained, including build-only and duplicate source copies','Module resolution is not proof of call-site execution','Native control is a synthetic one-pixel image operation, not production request coverage','Linux, edge deployment, alias resolution and independent review remain pending']};
const header=JSON.stringify({summary,nativeProof:{...nativeProof,selectedNative,selectorSources:helperProof}},null,2).slice(0,-2);
fs.writeFileSync(path.join(output,'occurrence-closure.json'),header+',\n  \"matrix\": [\n'+matrix.map(row=>'    '+JSON.stringify(row)).join(',\n')+'\n  ]\n}\n');
const cell=value=>String(value??'').replaceAll('|','&#124;').replaceAll('\n',' ').replaceAll('\\','/');
const markdown=['# Occurrence-level closure matrix','', 'Status: FAIL / HOLD. Overall packaging closure: '+summary.overallPackagingClosure+'.','', 'Application: '+build.sourceCommit+'; platform: win32-x64. All 140 original IDs are retained. See occurrence-closure.json for full source hashes, branch evidence, targets and obligations.','', 'Decisions: '+JSON.stringify(summary.decisions)+'. Scopes: '+JSON.stringify(summary.artifactScopes)+'.','', '| ID | Source:line | Scope / duplicate | Category / input | Closure | Reachability | Remaining obligation |','| --- | --- | --- | --- | --- | --- | --- |',...matrix.map(row=>'| '+[row.id,row.file+':'+row.line,row.artifactScope+(row.duplicateOf?' / #'+row.duplicateOf:''),row.category+' / '+row.input,row.decision,row.runtimeReachability,row.remainingObligation].map(cell).join(' | ')+' |'),''].join('\n');
fs.writeFileSync(path.join(output,'occurrence-closure.md'),markdown);
console.log(JSON.stringify(summary,null,2));
