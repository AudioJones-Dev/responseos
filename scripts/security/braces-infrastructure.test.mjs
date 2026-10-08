import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {collectAcceptance,toolingHash} from './braces-ci-accept.mjs';
import {references} from './braces-artifact-analysis.mjs';
const root=process.cwd(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'responseos-acceptance-controls-')),sha='1'.repeat(40),toolHash=toolingHash(root),results=[];
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?files(path.join(dir,item.name)):[path.join(dir,item.name)]);}
function write(dir,name,value){fs.mkdirSync(path.dirname(path.join(dir,name)),{recursive:true});fs.writeFileSync(path.join(dir,name),JSON.stringify(value,null,2)+'\n');}
function index(dir){write(dir,'evidence-index.json',files(dir).filter(file=>file!==path.join(dir,'evidence-index.json')).map(file=>({file:path.relative(dir,file).replaceAll('\\','/'),sha256:hash(fs.readFileSync(file))})));}
function bundle(dir,platform){
 const compatibility=Object.fromEntries(Object.entries({original:49,directory:441,tasks:584}).map(([name,total])=>[name,{total,pass:total,exit:0}]));
 const jobs={[platform==='win32'?'windows':'linux']:'success',diagnostics:'success',hostile:'success'};
 const report={platform,applicationSha:sha,auditSha:sha,compatibilitySha:sha,toolHash,auditExit:0,auditTotal:0,runtimeNativePass:true,candidateInstalled:true,closurePass:true,compatibility,jobs};
 write(dir,'verification-report.json',report);
 write(dir,'artifact-verification/build-summary.json',{sourceCommit:sha,platform,buildSucceeded:true,packageFilesUnchanged:true,steps:[{name:'audit',code:0}]});
 write(dir,'artifact-verification/audit.log',{metadata:{vulnerabilities:{total:0}}});
 write(dir,'artifact-verification/closure-ledger.json',{summary:{applicationSha:sha,packagingPass:true,occurrences:1},ledger:[{closure:'PASS'}]});
 write(dir,'artifact-verification/runtime-summary.json',{sourceCommit:sha,nativeOperationSucceeded:true,nativeProbeExit:0,escapes:[]});
 for(const [name,row]of Object.entries(compatibility))write(dir,'compatibility-'+name+'.log',{results:Array.from({length:row.total},()=>({pass:true}))});
 write(dir,'artifact-verification/native-summary.json',{exit:0,observation:{nativeSucceeded:true},escapes:[]});
 write(dir,'hostile.log',{results:Array.from({length:8},()=>({pass:true}))});index(dir);
}
let sequence=0;
function test(name,mutate,integration='success',expected=false){
 const dir=path.join(directory,String(sequence++)),win=path.join(dir,'windows'),linux=path.join(dir,'linux');
 bundle(win,'win32');bundle(linux,'linux');mutate({dir,win,linux});
 let pass=false,error=null;try{pass=collectAcceptance(dir,sha,toolHash,integration).pass;}catch(failure){error=failure.message;}
 assert.equal(pass,expected,name);results.push({name,pass:true,observedAcceptance:pass,error});
}
function editIndex(dir,change){const value=JSON.parse(fs.readFileSync(path.join(dir,'evidence-index.json')));change(value);write(dir,'evidence-index.json',value);}
function edit(dir,name,change){const file=path.join(dir,name),value=JSON.parse(fs.readFileSync(file));change(value);write(dir,name,value);index(dir);}
test('Synthetic complete pair is accepted',()=>{},'success',true);
test('Missing all reports',({win,linux})=>{fs.unlinkSync(path.join(win,'verification-report.json'));fs.unlinkSync(path.join(linux,'verification-report.json'));});
test('Incomplete platform coverage',({linux})=>fs.unlinkSync(path.join(linux,'verification-report.json')));
test('Duplicate platform reports',({dir,win})=>fs.cpSync(win,path.join(dir,'duplicate'),{recursive:true}));
test('Malformed report with matching inventory',({win})=>{fs.writeFileSync(path.join(win,'verification-report.json'),'{');index(win);});
test('Missing report inventory entry',({win})=>{const file=path.join(win,'evidence-index.json'),rows=JSON.parse(fs.readFileSync(file));write(win,'evidence-index.json',rows.filter(row=>row.file!=='verification-report.json'));});
test('Incomplete inventory',({win})=>{const file=path.join(win,'evidence-index.json'),rows=JSON.parse(fs.readFileSync(file));write(win,'evidence-index.json',rows.filter(row=>row.file!=='hostile.log'));});
test('Missing mandatory raw evidence',({win})=>{fs.unlinkSync(path.join(win,'artifact-verification/audit.log'));index(win);});
test('Corrupted report',({win})=>fs.appendFileSync(path.join(win,'verification-report.json'),' '));
test('Corrupted raw evidence',({win})=>fs.appendFileSync(path.join(win,'hostile.log'),' '));
test('Path traversal',({win})=>editIndex(win,rows=>rows.push({file:'../outside',sha256:'0'.repeat(64)})));
test('Duplicate inventory entries',({win})=>editIndex(win,rows=>rows.push(rows[0])));
test('Mismatched application identities',({linux})=>edit(linux,'verification-report.json',row=>row.applicationSha='2'.repeat(40)));
test('Mismatched tooling identities',({linux})=>edit(linux,'verification-report.json',row=>row.toolHash='2'.repeat(64)));
test('Audit summary contradicts raw scan',({win})=>edit(win,'artifact-verification/audit.log',row=>row.metadata.vulnerabilities.total=5));
test('Compatibility summary contradicts raw cases',({win})=>edit(win,'compatibility-tasks.log',row=>row.results[0].pass=false));
test('UNKNOWN occurrence cannot claim closure',({win})=>edit(win,'artifact-verification/closure-ledger.json',row=>row.ledger[0].closure='UNKNOWN'));
test('Hostile failure cannot claim success',({win})=>edit(win,'hostile.log',row=>row.results[0].pass=false));
test('Native load failure cannot claim success',({win})=>edit(win,'artifact-verification/runtime-summary.json',row=>row.nativeOperationSucceeded=false));
test('Missing native success evidence',({win})=>edit(win,'verification-report.json',row=>delete row.runtimeNativePass));
test('Missing native raw evidence',({win})=>{fs.unlinkSync(path.join(win,'artifact-verification/native-summary.json'));index(win);});
test('Evidence links prohibited',({win,linux})=>fs.symlinkSync(linux,path.join(win,'linked'),process.platform==='win32'?'junction':'dir'));
for(const status of ['failure','cancelled','skipped','pending',null])test('Integration '+String(status),()=>{},status);
const ts=createRequire(path.resolve('package.json'))('typescript');
const source='if (mode) require("then"); else require("else"); try {require("try");} catch(e){require("catch");} finally {require("finally");} mode ? require("yes") : require("no"); mode && require("and"); switch (target) {case "a": case "b": require("case");break;default:require("default");}';
const refs=references(ts,'synthetic.js',source),ref=name=>refs.find(row=>row.input===name);
assert.equal(ref('then').guards[0].branch,'true');assert.equal(ref('else').guards[0].branch,'false');
for(const branch of ['try','catch','finally'])assert.equal(ref(branch).guards[0].branch,branch);
assert.equal(ref('yes').guards[0].branch,'true');assert.equal(ref('no').guards[0].branch,'false');assert.equal(ref('and').guards[0].kind,'short-circuit');
assert.deepEqual(ref('case').guards[0].labels,['"a"','"b"']);assert.equal(ref('default').guards[0].expression,'default');
results.push({name:'AST true/false/exception/conditional/short-circuit/fallthrough distinctions',pass:true});
const empty=path.join(directory,'empty');fs.mkdirSync(empty);
const cli=spawnSync(process.execPath,[fileURLToPath(new URL('./braces-ci-accept.mjs',import.meta.url)),empty],{cwd:root,env:{PATH:process.env.PATH},encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(cli.status,1);assert.match(cli.stdout,/missing-or-inconsistent-platform-evidence/);results.push({name:'CLI exits nonzero without reports',pass:true});
const output=process.argv[2];if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({scope:'Synthetic gate controls, not application acceptance',results},null,2)+'\n');}
console.log('PASS: '+results.length+' repeatable infrastructure controls; positive acceptance uses synthetic evidence only');
