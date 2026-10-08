import {pathToFileURL} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import {probeNative} from './braces-native-probe.mjs';
import {tracedFiles,untracedLoads,launcherFile} from './braces-traced-runtime.mjs';
import {spawn,spawnSync} from 'node:child_process';
const root=process.cwd(),evidence=path.join(root,'.security-evidence/artifact-verification');
const build=JSON.parse(fs.readFileSync(path.join(evidence,'build-summary.json')));
if(!build.buildSucceeded)throw new Error('Fresh successful build required');
const node=process.execPath;
const hook=path.join(root,'scripts/security/braces-runtime-preload.mjs');
const standalone=fs.existsSync(path.join(build.checkout,'.next/standalone'));
const traced=standalone?null:tracedFiles(build.checkout);
const runtime=standalone?fs.mkdtempSync(path.join(build.scratch,'runtime-')):build.checkout;

function inventory(dir){
 if(traced)return traced.files.map(file=>{const data=fs.readFileSync(path.join(runtime,file));return {file,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};});
 const result=[];
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,item.name);
  if(item.isSymbolicLink())throw new Error('Runtime link needs explicit review: '+file);
  if(item.isDirectory())result.push(...inventory(file));
  else result.push({file:path.relative(runtime,file).replaceAll('\\','/'),bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
 }
 return result.sort((a,b)=>a.file.localeCompare(b.file));
}
if(standalone){
 fs.cpSync(path.join(build.checkout,'.next/standalone'),runtime,{recursive:true});
 fs.cpSync(path.join(build.checkout,'.next/static'),path.join(runtime,'.next/static'),{recursive:true});
 if(fs.existsSync(path.join(build.checkout,'public')))fs.cpSync(path.join(build.checkout,'public'),path.join(runtime,'public'),{recursive:true});
}
const before=inventory(runtime);
const baseEnv={...build.env};
delete baseEnv.npm_config_include;delete baseEnv.npm_config_userconfig;
const controlLog=path.join(evidence,'hook-control.jsonl');fs.writeFileSync(controlLog,'');
const control=spawnSync(node,['--import',pathToFileURL(hook).href,'--input-type=module','--eval',`import {createRequire} from 'node:module'; import fs from 'node:fs'; const r=createRequire(${JSON.stringify(path.join(build.checkout,'package.json'))}); if(r('braces')('{a,b}',{expand:true}).length!==2)throw Error('control');`],{cwd:build.checkout,env:{...baseEnv,RESPONSEOS_PROBE_ROOT:build.checkout,RESPONSEOS_PROBE_LOG:controlLog},encoding:'utf8',windowsHide:true,timeout:10000});
if(control.status!==0)throw new Error('Hook positive control failed: '+control.stderr);
const controlEvents=fs.readFileSync(controlLog,'utf8').trim().split('\n').map(line=>JSON.parse(line));
if(!controlEvents.some(item=>item.kind==='cjs-loaded'&&item.request==='braces')||!controlEvents.some(item=>item.kind==='esm-loaded'))throw new Error('CJS/ESM hook control incomplete');
const port=await new Promise((resolve,reject)=>{const server=net.createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
const runtimeLog=path.join(evidence,'runtime-loads.jsonl');fs.writeFileSync(runtimeLog,'');
const output=fs.createWriteStream(path.join(evidence,'runtime-server.log'));
const start=standalone?['server.js']:[path.join(runtime,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)];
let firstRequestAt=null;
const child=spawn(node,['--import',pathToFileURL(hook).href,...start],{cwd:runtime,env:{...baseEnv,HOSTNAME:'127.0.0.1',PORT:String(port),NEXT_PUBLIC_APP_URL:`http://127.0.0.1:${port}`,RESPONSEOS_PROBE_ROOT:runtime,RESPONSEOS_PROBE_LOG:runtimeLog},windowsHide:true,stdio:['ignore','pipe','pipe']});
child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});
let exited=false;const closed=new Promise(resolve=>child.on('close',(code,signal)=>{exited=true;resolve({code,signal});}));
const requests=[];let failure=null;
try{
 let ready=false;
 const deadline=Date.now()+30000;
 // Next listens before it initializes and holds every request until initialization ends. A dotted public
 // file bypasses proxy.ts, so its response ends the window in which named launcher files may load.
 const warmup=traced&&fs.readdirSync(path.join(runtime,'public'),{withFileTypes:true}).find(item=>item.isFile()&&item.name.includes('.'))?.name;
 if(traced&&!warmup)throw new Error('Traced runtime needs a dotted public file for its warm-up request');
 while(warmup&&Date.now()<deadline&&!exited){
  try{const response=await fetch(`http://127.0.0.1:${port}/${encodeURIComponent(warmup)}`,{redirect:'manual',signal:AbortSignal.timeout(2000)});await response.arrayBuffer();if(response.status===200)break;}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 firstRequestAt=new Date().toISOString();
 while(Date.now()<deadline&&!exited){
  try{const response=await fetch(`http://127.0.0.1:${port}/api/health`,{redirect:'manual',signal:AbortSignal.timeout(2000)});await response.arrayBuffer();ready=true;break;}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 if(!ready)throw new Error('Standalone startup failed or timed out');
 for(const route of ['/api/health','/','/demo/receptionist','/demo/client-dashboard','/admin','/client/dashboard','/api/accounts','/api/auth/session','/demo/packaging-closure-missing']){
  const response=await fetch(`http://127.0.0.1:${port}${route}`,{redirect:'manual',signal:AbortSignal.timeout(10000)});
  const body=await response.text();requests.push({route,status:response.status,location:response.headers.get('location'),bytes:Buffer.byteLength(body),sha256:crypto.createHash('sha256').update(body).digest('hex'),health:route==='/api/health'?JSON.parse(body):undefined});
 }
}catch(error){failure=error.message;}finally{if(!exited)child.kill();}
const exit=await closed;await new Promise(resolve=>output.end(resolve));
const after=inventory(runtime),byName=new Map(after.map(item=>[item.file,item]));
const changes=before.filter(item=>!byName.has(item.file)||item.sha256!==byName.get(item.file).sha256);
const added=after.filter(item=>!before.some(prior=>prior.file===item.file));
const events=fs.readFileSync(runtimeLog,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
const targets=/eslint-config-next|@next[\\/]eslint-plugin-next|fast-glob|micromatch|(?:^|[\\/])braces(?:[\\/]|$)/;
const nativeProbe=probeNative(runtime,baseEnv,evidence);
const untraced=traced?untracedLoads(events,runtime,traced):[];
const excused=item=>item.time<firstRequestAt&&launcherFile(item.file),untracedStartupLoads=untraced.filter(excused),untracedRequestLoads=untraced.filter(item=>!excused(item));
const summary={nativeOperationSucceeded:nativeProbe.observation.nativeSucceeded===true&&nativeProbe.exit===0&&nativeProbe.escapes.length===0,nativeProbeExit:nativeProbe.exit,nativeProbeError:nativeProbe.observation.error||null,capturedAt:new Date().toISOString(),sourceCommit:build.sourceCommit,packaging:standalone?'standalone':'traced',tracedPackage:traced&&{traceFiles:traced.traceFiles,files:traced.files.length,links:traced.links},untracedStartupLoads:[...new Set(untracedStartupLoads.map(item=>item.file))].sort(),untracedRequestLoads:[...new Set(untracedRequestLoads.map(item=>item.file))].sort(),runtime,port,controlExit:control.status,controlEvents:controlEvents.length,requests,failure,exit,eventCount:events.length,affectedEvents:events.filter(item=>targets.test([item.request,item.file,item.specifier,item.url].filter(Boolean).join(' '))),escapes:events.filter(item=>item.kind==='escape-blocked'),resolutionFailures:events.filter(item=>item.kind==='cjs-failed'),changedOriginalFiles:changes,addedFiles:added,limitations:['Startup, public GETs, protected denials and public 404 only','Embedded code execution is not established by module load hooks',standalone?'Fresh Windows standalone artifact, not deployed Vercel artifact':'Traced package served by next start from the build checkout; only named next start launcher files may load untraced, and only before the warm-up response; Vercel replaces that launcher; not the deployed Vercel artifact']};
for(const [name,value]of Object.entries({'runtime-before':before,'runtime-after':after,'runtime-summary':summary}))fs.writeFileSync(path.join(evidence,name+'.json'),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({...summary,resolutionFailures:summary.resolutionFailures.slice(0,3)},null,2));
if(!summary.nativeOperationSucceeded||failure||summary.escapes.length||changes.length||summary.untracedRequestLoads.length||requests.some(item=>item.route==='/demo/packaging-closure-missing'?item.status!==404:['/admin','/client/dashboard','/api/accounts','/api/auth/session'].includes(item.route)?item.status!==307||new URL(item.location,'http://127.0.0.1').pathname!=='/':item.status!==200)||requests[0]?.health?.build_sha!==build.sourceCommit)process.exitCode=1;
