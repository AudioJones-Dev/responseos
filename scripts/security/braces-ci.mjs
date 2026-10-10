import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {acceptance} from './braces-acceptance.mjs';
import {toolingHash} from './braces-ci-accept.mjs';
const root=process.cwd(),evidence=path.resolve('.security-evidence');fs.mkdirSync(evidence,{recursive:true});
const node=process.execPath,npm=process.env.SECURITY_NPM_CLI||process.env.npm_execpath;
if(!npm)throw new Error('Pinned npm CLI required');
const steps=[];
function run(name,args,cwd=root,env=process.env){
 console.log('Running '+name);
 const result=spawnSync(node,args,{cwd,env,encoding:'utf8',windowsHide:true,timeout:900000,maxBuffer:50000000});
 fs.writeFileSync(path.join(evidence,name+'.log'),(result.stdout||'')+(result.stderr||''));
 steps.push({name,exit:result.status,error:result.error?.message||null});return result;
}
if(process.version!=='v24.18.0'||spawnSync(node,[npm,'--version'],{encoding:'utf8'}).stdout.trim()!=='11.16.0')throw new Error('Node/npm version mismatch');
if(run('infrastructure-controls',['scripts/security/braces-infrastructure.test.mjs',path.join(evidence,'infrastructure-controls.json')]).status!==0)process.exit(1);
const buildResult=run('artifact-build',['scripts/security/braces-artifact-build.mjs']);
let build;
try{build=JSON.parse(fs.readFileSync(path.join(evidence,'artifact-verification/build-summary.json')));}catch{}
if(buildResult.status===0&&build?.buildSucceeded){
 run('inspect',['scripts/security/braces-artifact-inspect.mjs']);run('runtime',['scripts/security/braces-artifact-runtime.mjs']);run('controls',['scripts/security/braces-artifact-analysis.test.mjs']);run('closure',['scripts/security/braces-packaging-closure.mjs']);
 const testEnv={...build.env,NODE_ENV:'test'};delete testEnv.RESPONSEOS_REQUIRE_AUTH;
 for(const command of ['lint','typecheck','test'])run('application-'+command,[npm,'run',command],build.checkout,testEnv);
 run('synthetic-auth',['scripts/security/braces-synthetic-trace.mjs']);
}
fs.mkdirSync('.security-tools/matcher',{recursive:true});
for(const name of ['package.json','package-lock.json'])fs.copyFileSync('docs/security/fixtures/matcher-'+name,'.security-tools/matcher/'+name);
run('matcher-install',[npm,'ci','--prefix','.security-tools/matcher','--ignore-scripts','--no-fund']);
const compatibility={};
for(const [name,args,total]of [['original',['scripts/security/braces-compatibility.mjs','matcher'],49],['directory',['scripts/security/braces-compatibility.mjs','matcher','--extended','--ordered'],441],['tasks',['scripts/security/braces-task-parity.mjs'],584]]){
 const result=run('compatibility-'+name,args);
 try{const parsed=JSON.parse(result.stdout);compatibility[name]={total:parsed.results.length,pass:parsed.results.filter(row=>row.pass).length,exit:result.status};if(parsed.results.length!==total)compatibility[name].exit=1;}catch{compatibility[name]={total:0,pass:0,exit:1};}
}
run('hostile',['scripts/security/braces-hostile-input.mjs']);run('gate-controls',['scripts/security/braces-gates.test.mjs']);
let audit={},closure={},runtime={},candidateInstalled=false;
try{audit=JSON.parse(fs.readFileSync(path.join(evidence,'artifact-verification/audit.log')));}catch{}
try{closure=JSON.parse(fs.readFileSync(path.join(evidence,'artifact-verification/closure-ledger.json'))).summary;}catch{}
try{runtime=JSON.parse(fs.readFileSync(path.join(evidence,'artifact-verification/runtime-summary.json')));}catch{}
try{candidateInstalled=fs.realpathSync(createRequire(path.join(build.checkout,'package.json')).resolve('micromatch'))===fs.realpathSync(path.resolve('scripts/security/braces-matcher-experiment.mjs'));}catch{}
const status=name=>steps.find(step=>step.name===name)?.exit===0?'success':'failure';
const toolHash=toolingHash();
const report={runtimeNativePass:runtime.nativeOperationSucceeded===true,toolHash,platform:process.platform,applicationSha:build?.sourceCommit||process.env.SECURITY_APPLICATION_SHA,auditSha:build?.sourceCommit,compatibilitySha:build?.sourceCommit,auditExit:build?.steps.find(step=>step.name==='audit')?.code,auditTotal:audit.metadata?.vulnerabilities?.total,compatibility,candidateInstalled,closurePass:closure.packagingPass===true,steps,jobs:{[process.platform==='win32'?'windows':'linux']:steps.filter(step=>['infrastructure-controls','artifact-build','inspect','runtime','controls','application-lint','application-typecheck','application-test','synthetic-auth','gate-controls'].includes(step.name)).length===10&&steps.filter(step=>['infrastructure-controls','artifact-build','inspect','runtime','controls','application-lint','application-typecheck','application-test','synthetic-auth','gate-controls'].includes(step.name)).every(step=>step.exit===0)?'success':'failure',hostile:status('hostile'),diagnostics:'failure',integration:'pending'}};
report.jobs.diagnostics=report.jobs[process.platform==='win32'?'windows':'linux'];
report.acceptance=acceptance(report);
fs.writeFileSync(path.join(evidence,'verification-report.json'),JSON.stringify(report,null,2)+'\n');
function index(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?index(path.join(dir,item.name)):[path.join(dir,item.name)]);}
fs.writeFileSync(path.join(evidence,'evidence-index.json'),JSON.stringify(index(evidence).filter(file=>path.basename(file)!=='evidence-index.json').sort().map(file=>({file:path.relative(evidence,file).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),null,2)+'\n');
console.log(JSON.stringify(report,null,2));
// A separate final job rejects findings and mismatches after diagnostics upload.
if(report.jobs.diagnostics!=='success')process.exitCode=1;
