import Module from 'node:module';
import path from 'node:path';
import * as candidateMatcher from './braces-matcher-experiment.mjs';
const load = Module.createRequire(path.resolve('package.json'));
const original = load('fast-glob');
for (const file of Object.keys(load.cache)) if (file.includes(path.sep + 'fast-glob' + path.sep)) delete load.cache[file];
const originalLoad = Module._load;
Module._load = function(id, parent, ...rest) {
  if (id === 'micromatch' && parent.filename.endsWith(path.join('fast-glob','out','utils','pattern.js'))) return candidateMatcher;
  return originalLoad.call(this, id, parent, ...rest);
};
let candidate;
try { candidate = load('fast-glob'); } finally { Module._load = originalLoad; }
const cases=JSON.parse((await import('node:fs')).readFileSync(path.resolve('docs/security/fixtures/task-inputs.json')));
function tasks(engine, input) {
  try { return {tasks:engine.generateTasks(input,{onlyDirectories:true})}; }
  catch(error) { return {error:error.name,message:error.message}; }
}
const results = cases.map(input=>{
  const expected=tasks(original,input),actual=tasks(candidate,input);
  return {input,expected,actual,pass:JSON.stringify(expected)===JSON.stringify(actual)};
});
console.log(JSON.stringify({node:process.version,platform:process.platform,results},null,2));
process.exitCode=results.every(result=>result.pass)?0:1;
