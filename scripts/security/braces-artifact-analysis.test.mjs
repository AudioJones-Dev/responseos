import {pathToFileURL} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {signals,references} from './braces-artifact-analysis.mjs';
const root=process.cwd(),evidence=path.join(root,'.security-evidence/artifact-verification');
const build=JSON.parse(fs.readFileSync(path.join(evidence,'build-summary.json')));
const load=createRequire(path.join(build.checkout,'package.json')),ts=load('typescript');
const results=[];
function test(name,fn){fn();results.push({name,pass:true});}
test('Affected package identifier detected',()=>assert.deepEqual(signals('require("braces")').names,['braces']));
test('Metadata identifier not sufficient implementation evidence',()=>assert.equal(signals('{"devDependencies":{"eslint-config-next":"16.3.4"}}').implementation.length,0));
for(const kind of ['expand','compile'])test('Original '+kind+' walker detected without package name',()=>assert.ok(signals(fs.readFileSync(path.join(build.checkout,'node_modules/braces/lib',kind+'.js'),'utf8')).implementation.length));
test('Static and dynamic module syntax retained',()=>{
 const refs=references(ts,'fixture.mjs','import a from "braces"; export {b} from "micromatch"; require("fast-glob"); import("eslint-config-next"); require(candidate); import(candidate);');
 assert.equal(refs.length,6);assert.equal(refs.filter(item=>!item.literal).length,2);assert.ok(refs.some(item=>item.input==='fast-glob'&&item.kind==='require'));
});
test('Out-of-package load is rejected by runtime hook',()=>{
 const log=path.join(evidence,'escape-control.jsonl');fs.writeFileSync(log,'');
 const child=spawnSync(process.execPath,['--import',pathToFileURL(path.join(root,'scripts/security/braces-runtime-preload.mjs')).href,'--eval',`require(${JSON.stringify(path.join(build.checkout,'node_modules/braces/index.js'))})`],{cwd:JSON.parse(fs.readFileSync(path.join(evidence,'runtime-summary.json'))).runtime,env:{...build.env,RESPONSEOS_PROBE_ROOT:JSON.parse(fs.readFileSync(path.join(evidence,'runtime-summary.json'))).runtime,RESPONSEOS_PROBE_LOG:log},encoding:'utf8',windowsHide:true,timeout:10000});
 assert.notEqual(child.status,0);assert.ok(fs.readFileSync(log,'utf8').includes('escape-blocked'));
});
fs.writeFileSync(path.join(evidence,'tool-tests.json'),JSON.stringify({node:process.version,results},null,2)+'\n');
console.log(JSON.stringify(results));
