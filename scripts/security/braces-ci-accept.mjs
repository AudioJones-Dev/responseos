import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {acceptance} from './braces-acceptance.mjs';
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
export function toolingHash(root=process.cwd()){
 return hash(['scripts/security','docs/security/fixtures'].flatMap(dir=>fs.readdirSync(path.join(root,dir)).filter(name=>dir.includes('fixtures')||name.endsWith('.mjs')).sort().map(name=>dir+'/'+name+'\n'+fs.readFileSync(path.join(root,dir,name),'utf8').replaceAll('\r\n','\n'))).join('\n')+'\n.github/workflows/security-packaging-proposal.yml\n'+fs.readFileSync(path.join(root,'.github/workflows/security-packaging-proposal.yml'),'utf8').replaceAll('\r\n','\n'));
}
function files(dir){
 if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>{
  if(item.isSymbolicLink())throw new Error('Evidence links are prohibited');
  return item.isDirectory()?files(path.join(dir,item.name)):[path.join(dir,item.name)];
 });
}
export function verifyBundle(dir){
 const index=JSON.parse(fs.readFileSync(path.join(dir,'evidence-index.json'),'utf8'));
 if(!Array.isArray(index)||!index.some(row=>row.file==='verification-report.json'))throw new Error('Missing evidence inventory');
 const names=new Set(),base=fs.realpathSync(dir);
 for(const row of index){
  if(typeof row.file!=='string'||path.isAbsolute(row.file)||row.file.includes('\\')||row.file.includes(':')||row.file.split('/').some(part=>!part||part==='.'||part==='..')||names.has(row.file)||!/^[0-9a-f]{64}$/.test(row.sha256||''))throw new Error('Invalid evidence inventory entry');
  names.add(row.file);const target=path.join(dir,row.file),real=fs.realpathSync(target);
  if(!real.startsWith(base+path.sep)||hash(fs.readFileSync(target))!==row.sha256)throw new Error('Evidence hash mismatch');
 }
 for(const file of files(dir))if(file!==path.join(dir,'evidence-index.json')&&!names.has(path.relative(dir,file).replaceAll('\\','/')))throw new Error('Incomplete evidence inventory');
 const required=['verification-report.json','artifact-verification/build-summary.json','artifact-verification/audit.log','artifact-verification/closure-ledger.json','artifact-verification/runtime-summary.json','compatibility-original.log','compatibility-directory.log','compatibility-tasks.log','hostile.log'];
 for(const name of required)if(!names.has(name))throw new Error('Missing required evidence: '+name);
 const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')),report=read('verification-report.json'),build=read('artifact-verification/build-summary.json'),audit=read('artifact-verification/audit.log'),closure=read('artifact-verification/closure-ledger.json'),runtime=read('artifact-verification/runtime-summary.json');
 if(report.applicationSha!==build.sourceCommit||report.auditSha!==build.sourceCommit||build.platform!==report.platform||runtime.sourceCommit!==build.sourceCommit||closure.summary.applicationSha!==build.sourceCommit)throw new Error('Raw evidence identity mismatch');
 if(report.auditTotal!==audit.metadata?.vulnerabilities?.total||report.auditExit!==build.steps?.find(row=>row.name==='audit')?.code)throw new Error('Audit report mismatch');
 if(report.closurePass!==closure.summary.packagingPass||typeof report.closurePass!=='boolean'||!Array.isArray(closure.ledger)||!Array.isArray(runtime.escapes)||closure.summary.occurrences!==closure.ledger.length)throw new Error('Closure report mismatch');
 if(report.runtimeNativePass!==undefined){
  if(typeof report.runtimeNativePass!=='boolean'||report.runtimeNativePass!==runtime.nativeOperationSucceeded)throw new Error('Native report mismatch');
  if(!names.has('artifact-verification/native-summary.json'))throw new Error('Missing native raw evidence');
  const probe=read('artifact-verification/native-summary.json'),nativePass=probe.exit===0&&probe.observation?.nativeSucceeded===true&&Array.isArray(probe.escapes)&&probe.escapes.length===0;
  if(report.runtimeNativePass!==nativePass||runtime.nativeProbeExit!==probe.exit)throw new Error('Native raw evidence mismatch');
 }
 if(report.closurePass&&(!closure.ledger.length||closure.ledger.some(row=>row.closure!=='PASS')||runtime.escapes.length||build.buildSucceeded!==true||build.packageFilesUnchanged!==true))throw new Error('Unproven closure');
 for(const name of ['original','directory','tasks']){
  const raw=read('compatibility-'+name+'.log'),claimed=report.compatibility?.[name];
  if(!Array.isArray(raw.results)||!claimed||claimed.total!==raw.results.length||claimed.pass!==raw.results.filter(row=>row.pass===true).length)throw new Error('Compatibility report mismatch');
 }
 const hostile=read('hostile.log');
 if(report.jobs?.hostile==='success'&&(!Array.isArray(hostile.results)||hostile.results.length!==8||hostile.results.some(row=>row.pass!==true)))throw new Error('Hostile report mismatch');
 return report;
}
export function collectAcceptance(directory,applicationSha,expectedToolHash,integrationResult){
 const paths=files(directory).filter(file=>path.basename(file)==='verification-report.json'),reports=paths.map(file=>verifyBundle(path.dirname(file)));
 const win=reports.find(row=>row.platform==='win32'),linux=reports.find(row=>row.platform==='linux');
 const results=[win,linux].map(row=>acceptance({...row,jobs:{...row?.jobs,windows:win?.jobs.windows,linux:linux?.jobs.linux,integration:integrationResult}}));
 if(reports.length!==2||!win||!linux||win.toolHash!==expectedToolHash||win.applicationSha!==linux.applicationSha||win.applicationSha!==applicationSha||win.toolHash!==linux.toolHash)results.push({pass:false,failures:['missing-or-inconsistent-platform-evidence']});
 return {pass:results.every(row=>row.pass),results};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=collectAcceptance(process.argv[2]||'downloaded-evidence',process.env.SECURITY_APPLICATION_SHA,toolingHash(),process.env.INTEGRATION_RESULT);console.log(JSON.stringify(result,null,2));process.exitCode=result.pass?0:1;}
 catch(error){console.error('FAIL: '+error.message);process.exitCode=1;}
}
