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
const runtime=read('artifact-verification/runtime-summary.json'),traced=runtime.packaging==='traced';
if(!traced){
 const archive='docs/security/packaging-proposal-evidence/raw-evidence.tar.gz',archiveManifest=JSON.parse(fs.readFileSync('docs/security/packaging-proposal-evidence/archive.json'));
 if(hash(fs.readFileSync(archive))!==archiveManifest.sha256)throw new Error('Preserved archive hash mismatch');
}
// Traced ledgers have no committed identity yet, so a frozen identity file is required: {applicationSha, platform, occurrences, ledgerSha256}.
if(traced&&!process.argv[4])throw new Error('Traced packaging requires a frozen identity file argument');
const frozen=traced?JSON.parse(fs.readFileSync(process.argv[4],'utf8')):{applicationSha:'4e1f353117696658988bca171e4e0e51c0fb1b96',platform:'win32',occurrences:140};
const ledgerFile=traced?path.join(evidence,'artifact-verification/closure-ledger.json'):'docs/security/packaging-proposal-evidence/artifact-verification/closure-ledger.json';
const report=verifyBundle(evidence),build=read('artifact-verification/build-summary.json'),original=JSON.parse(fs.readFileSync(ledgerFile,'utf8')),inventory=read('artifact-verification/inventory.json'),before=read('artifact-verification/runtime-before.json');
if(build.sourceCommit!==frozen.applicationSha||build.platform!==frozen.platform||process.version!==build.node||original.ledger.length!==frozen.occurrences||original.ledger.some((row,index)=>row.id!==index+1)||traced&&hash(fs.readFileSync(ledgerFile))!==frozen.ledgerSha256)throw new Error('Frozen occurrence identity mismatch');
const checkout=build.checkout,ts=createRequire(path.join(checkout,'package.json'))('typescript');
const inventoryMap=new Map(inventory.map(row=>[row.file,row])),runtimeMap=new Map(before.map(row=>[row.file,row]));
const events=fs.readFileSync(path.join(evidence,'artifact-verification/runtime-loads.jsonl'),'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line));
fs.mkdirSync(output,{recursive:true});
const native=probeNative(runtime.runtime,build.env,output),nativeProof=native.observation,nativeEvents=native.events;
const installed=probeNative(build.checkout,build.env,output,'installed-native');
const selected=nativeProof.runtimePlatform;
if(nativeProof.platform!==build.platform||!/^[a-z0-9]+-[a-z0-9]+$/.test(selected||'')||!traced&&selected!=='win32-x64'||nativeEvents.some(row=>row.kind==='escape-blocked'))throw new Error('Unsupported native platform control');
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?files(path.join(dir,item.name)):[path.join(dir,item.name)]);
const nativeFolders=['node_modules/@img/sharp-'+selected+'/lib','node_modules/@img/sharp-libvips-'+selected+'/lib'].filter(folder=>fs.existsSync(path.join(build.checkout,folder)));
const missingPackagedFiles=nativeFolders.flatMap(folder=>files(path.join(build.checkout,folder))).map(file=>path.relative(build.checkout,file).replaceAll('\\','/')).filter(file=>!runtimeMap.has(file)).map(file=>({file,sourceSha256:hash(fs.readFileSync(path.join(build.checkout,file))),packaged:false}));
fs.writeFileSync(path.join(output,'native-packaging-comparison.json'),JSON.stringify({applicationSha:build.sourceCommit,node:process.version,installedProbeExit:installed.exit,installedObservation:installed.observation,nativeFolders,missingPackagedFiles,scope:traced?'Traced package compared with installed native folders; nothing copied':'Original inspected package unchanged; no DLL copied'},null,2)+'\n');
const selectedNative=[...new Set(nativeEvents.filter(row=>row.kind==='cjs-resolve'&&row.file?.endsWith('.node')).map(row=>row.file))].map(file=>{
 const relative=path.relative(runtime.runtime,file).replaceAll('\\','/'),item=runtimeMap.get(relative);
 if(!item||hash(fs.readFileSync(file))!==item.sha256)throw new Error('Selected native target hash mismatch');
 return {file:relative,sha256:item.sha256,resolutionObserved:true,nativeOperationSucceeded:nativeProof.nativeSucceeded};
});
if(!selectedNative.some(row=>row.file.includes('@img/sharp-'+selected+'/')))throw new Error('Selected native target not observed');
const cache=new Map();
function source(file){
 if(!cache.has(file)){
  const text=fs.readFileSync(path.join(checkout,file),'utf8'),item=inventoryMap.get(file);
  if(!item||hash(text)!==item.sha256)throw new Error('Artifact source hash mismatch: '+file);
  cache.set(file,{text,hash:item.sha256,refs:references(ts,file,text),used:new Set()});
 }return cache.get(file);
}
const escape=text=>text.replace(/[.*+?^${}()|[\]\\/]/g,'\\$&'),prefix=traced?'':'.next/standalone/',sharpSource=new RegExp('^'+escape(prefix)+'node_modules/sharp/dist/sharp\\.(cjs|mjs)$'),helperFiles=[prefix+'node_modules/sharp/dist/libvips.cjs',prefix+'node_modules/sharp/dist/libvips.mjs'];
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
  scope=traced||row.file.startsWith('.next/standalone/')?'PACKAGED_RUNTIME':'DUPLICATED_RUNTIME_COPY';
  if(!traced)duplicateOf=original.ledger.find(other=>other.id!==row.id&&other.file==='.next/standalone/'+row.file&&other.evidence.sourceHash===entry.hash&&other.evidence.input===ref.input&&other.evidence.line===ref.line)?.id||null;
  proof.push({kind:'packaged-file',file:relative,sha256:packaged.sha256});
 }else if(row.file.startsWith('.next/build/')){
  scope='BUILD_ONLY_OUTPUT';decision='CLOSED_SOURCE_FILE_EXCLUDED';obligation='Reassess if deployment packaging includes build output; embedded equivalents remain a separate obligation';
  proof.push({kind:'runtime-inventory-exclusion',file:relative,inventory:'artifact-verification/runtime-before.json',inventorySha256:hash(fs.readFileSync(path.join(evidence,'artifact-verification/runtime-before.json')))});
 }
 const platformGuard=ref.guards.find(guard=>guard.kind==='switch-case'&&guard.discriminant==='runtimePlatform');
 if(packaged&&sharpSource.test(row.file)&&entry.text.includes('const runtimePlatform = runtimePlatformArch();')&&new RegExp('case "'+escape(selected)+'":\\s*sharp = require\\("@img/sharp-'+escape(selected)+'/sharp\\.node"\\);\\s*break;').test(entry.text)&&platformGuard&&!platformGuard.labels.includes('"'+selected+'"')&&!platformGuard.labels.includes('default')){
  decision=selected==='win32-x64'?'CLOSED_INACTIVE_WINDOWS_BRANCH':'CLOSED_INACTIVE_PLATFORM_BRANCH';obligation=selected==='win32-x64'?'Windows x64 selector only; Linux and other platforms require their own artifacts and selector proof':selected+' selector only; other platforms require their own artifacts and selector proof';
  proof.push({kind:'inactive-platform-case',selected:nativeProof.runtimePlatform,cases:platformGuard.labels,selectorSources:helperProof,nativeTargets:selectedNative});
 }

 const linuxGuard=ref.guards.find(guard=>guard.kind==='if'&&guard.branch==='true'&&guard.expression==='isLinux && /(symbol not found|CXXABI_)/i.test(messages)');
 if(packaged&&(traced||[116,134].includes(row.id))&&sharpSource.test(row.file)&&entry.text.includes('const runtimePlatform = runtimePlatformArch();')&&entry.text.includes('const [isLinux, isMacOs, isWindows] = ["linux", "darwin", "win32"].map((os) => runtimePlatform.startsWith(os));')&&linuxGuard&&(traced?!selected.startsWith('linux'):selected==='win32-x64')){
  decision='CLOSED_INACTIVE_LINUX_GUARD';obligation=selected==='win32-x64'?'Windows x64 false-guard proof only; Linux requires independent selector and failure-path evidence':selected+' false-guard proof only; Linux requires independent selector and failure-path evidence';
  proof.push({kind:'inactive-linux-guard',selected:nativeProof.runtimePlatform,expression:linuxGuard.expression,isLinux:false,definition:'["linux", "darwin", "win32"].map((os) => runtimePlatform.startsWith(os))',selectorSources:helperProof});
 }
 const loaded=events.some(event=>event.kind==='cjs-resolve'&&event.file===path.join(runtime.runtime,relative)||event.kind==='esm-resolve'&&event.url===pathToFileURL(path.join(runtime.runtime,relative)).href);
 return {id:row.id,applicationSha:build.sourceCommit,platform:selected,file:row.file,line:ref.line,column:ref.column,sourceHash:entry.hash,artifactScope:scope,duplicateOf,category:row.category,kind:ref.kind,input:ref.input,containingFunction:ref.containingFunction,guards:ref.guards,context:ref.context,proposedTarget:ref.literal?ref.input:'Requires computed target enumeration',decision,runtimeReachability:decision==='CLOSED_SOURCE_FILE_EXCLUDED'?'SOURCE_FILE_NOT_PACKAGED':decision.startsWith('CLOSED_INACTIVE_')?'INACTIVE_FOR_INSPECTED_PLATFORM':loaded?'MODULE_RESOLUTION_OBSERVED_CALL_SITE_UNPROVEN':'CALL_SITE_REACHABILITY_UNPROVEN',proof,remainingObligation:obligation};
});
const counts=field=>Object.fromEntries([...new Set(matrix.map(row=>row[field]))].map(value=>[value,matrix.filter(row=>row[field]===value).length]));
const summary={capturedAt:new Date().toISOString(),applicationSha:build.sourceCommit,toolHash:toolingHash(),packaging:traced?'traced':'standalone',platform:selected,occurrences:matrix.length,decisions:counts('decision'),artifactScopes:counts('artifactScope'),categories:counts('category'),duplicateRows:matrix.filter(row=>row.duplicateOf).length,overallPackagingClosure:nativeProof.nativeSucceeded?'UNKNOWN':'FAIL',nativeOperationSucceeded:nativeProof.nativeSucceeded,nativeFailure:nativeProof.error||null,auditFindings:report.auditTotal,taskFailures:report.compatibility.tasks.total-report.compatibility.tasks.pass,limitations:[traced?'Occurrence closure is scoped to the inspected traced '+selected+' package, not every deployment':'Occurrence closure is scoped to the inspected materialized Windows package, not every deployment',traced?'All '+frozen.occurrences+' frozen traced IDs are retained':'All 140 original IDs are retained, including build-only and duplicate source copies','Module resolution is not proof of call-site execution','Native control is a synthetic one-pixel image operation, not production request coverage',traced?'Other platforms, the deployed Vercel artifact, edge deployment, alias resolution and independent review remain pending':'Linux, edge deployment, alias resolution and independent review remain pending']};
const header=JSON.stringify({summary,nativeProof:{...nativeProof,selectedNative,selectorSources:helperProof}},null,2).slice(0,-2);
fs.writeFileSync(path.join(output,'occurrence-closure.json'),header+',\n  \"matrix\": [\n'+matrix.map(row=>'    '+JSON.stringify(row)).join(',\n')+'\n  ]\n}\n');
const cell=value=>String(value??'').replaceAll('|','&#124;').replaceAll('\n',' ').replaceAll('\\','/');
const markdown=['# Occurrence-level closure matrix','', 'Status: FAIL / HOLD. Overall packaging closure: '+summary.overallPackagingClosure+'.','', 'Application: '+build.sourceCommit+'; platform: '+selected+'. '+(traced?'Packaging: traced. All '+frozen.occurrences+' frozen traced IDs are retained.':'All 140 original IDs are retained.')+' See occurrence-closure.json for full source hashes, branch evidence, targets and obligations.','', 'Decisions: '+JSON.stringify(summary.decisions)+'. Scopes: '+JSON.stringify(summary.artifactScopes)+'.','', '| ID | Source:line | Scope / duplicate | Category / input | Closure | Reachability | Remaining obligation |','| --- | --- | --- | --- | --- | --- | --- |',...matrix.map(row=>'| '+[row.id,row.file+':'+row.line,row.artifactScope+(row.duplicateOf?' / #'+row.duplicateOf:''),row.category+' / '+row.input,row.decision,row.runtimeReachability,row.remainingObligation].map(cell).join(' | ')+' |'),''].join('\n');
fs.writeFileSync(path.join(output,'occurrence-closure.md'),markdown);
console.log(JSON.stringify(summary,null,2));
