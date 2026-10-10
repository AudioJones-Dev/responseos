import assert from 'node:assert/strict';
import {classify} from './braces-packaging-closure.mjs';
import {acceptance} from './braces-acceptance.mjs';
const complete={auditExit:0,auditTotal:0,compatibility:{original:{total:49,pass:49,exit:0},directory:{total:441,pass:441,exit:0},tasks:{total:584,pass:584,exit:0}},runtimeNativePass:true,candidateInstalled:true,closurePass:true,jobs:{windows:'success',linux:'success',integration:'success',hostile:'success',diagnostics:'success'},applicationSha:'1'.repeat(40),auditSha:'1'.repeat(40),compatibilitySha:'1'.repeat(40)};
assert.equal(acceptance(complete).pass,true);
for(const [name,changes]of Object.entries({fiveFindings:{auditExit:1,auditTotal:5},thirtySixDefects:{compatibility:{...complete.compatibility,tasks:{total:584,pass:548,exit:1}}},missingEvidence:{jobs:{}},failedRegression:{jobs:{...complete.jobs,integration:'failure'}},isolatedAudit:{candidateInstalled:false},unknownImports:{closurePass:false},wrongIdentity:{auditSha:'other'}}))assert.equal(acceptance({...complete,...changes}).pass,false,name);
for(const [input,literal,category]of [['@img/sharp-linux-x64/sharp.node',true,'platform-specific'],['@opentelemetry/api',true,'optional'],['react-server-dom-webpack/client',true,'framework-alias'],['resolved',false,'dynamic'],['missing-package',true,'missing']]){const row=classify({input,literal,line:1,context:'fixture',sourceHash:'fixture'},'win32');assert.equal(row.category,category);assert.notEqual(row.closure,'PASS');}
console.log('PASS: acceptance rejects known failures and classifier retains unproven closure');
