import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Module from 'node:module';
import * as candidateGlob from './braces-directory-experiment.mjs';
import * as candidateMatcher from './braces-matcher-experiment.mjs';
import { expandedPatterns } from './braces-pattern-cases.mjs';
const load = Module.createRequire(path.resolve('package.json'));
const pluginFile = load.resolve('@next/eslint-plugin-next/dist/utils/get-root-dirs');
const original = load(pluginFile).getRootDirs;
const kind = process.argv[2] || 'tiny';


if (kind === 'matcher') { for (const file of Object.keys(load.cache)) if (file.includes(path.sep + 'fast-glob' + path.sep)) delete load.cache[file]; }
const originalLoad = Module._load;
delete load.cache[pluginFile];
Module._load = function(id, parent, ...rest) {
  if (kind === 'tiny' && id === 'fast-glob' && parent.filename === pluginFile) return candidateGlob;
  if (kind === 'matcher' && id === 'micromatch' && parent.filename.endsWith(path.join('fast-glob','out','utils','pattern.js'))) return candidateMatcher;
  return originalLoad.call(this, id, parent, ...rest);
};
let candidate;
try { candidate = load(pluginFile).getRootDirs; } finally { Module._load = originalLoad; }
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'responseos-expanded-glob-'));
const cwd = process.cwd();
const cases = [undefined, 'apps/site', 'apps/site/', 'apps/*', 'apps/**', 'apps/{site,admin}', ['apps/site','apps/admin'], 'apps/site space', 'missing', 'apps/.hidden', 'apps\\site', path.join(fixture,'apps/site'), 'apps/site/file.txt', '.', './', './apps/site', './apps/*', 'apps//site', 'apps/**/', 'apps/**/*', 'apps/*/**', 'apps/**/nested', 'apps/**/nested/**', 'apps/!(admin)', 'apps/@(site|admin)', 'apps/[sa]*', 'apps/{1..3}', 'apps/{01..03}', 'apps/{3..1}', 'apps/{1..3..2}', 'apps/{site,{admin,other}}', 'apps/{site,}', 'apps/{,site}', 'apps/{site,site}', 'apps/{site}', 'apps/{}', 'apps/{{site,admin}}', 'apps/${site,admin}', 'apps/"{site,admin}"', 'apps/{site,,admin}', 'apps/{-2..2}', 'apps/{a..Z}', 'apps/{1..1001}', '!apps/site', ['apps/site','apps/site'], ['apps/site',null,42], path.join(fixture,'apps/*'), 'apps/link', 'apps/link/**'];
if (process.argv.includes('--extended')) cases.push(...expandedPatterns());
function normalize(value) {
  const paths = value.map(p=>p.replaceAll('\\','/').replace(fixture.replaceAll('\\','/'),'<fixture>'));
  return process.argv.includes('--ordered') ? paths : paths.sort();
}
function run(engine,rootDir) {
  try { return {paths:normalize(engine({cwd:process.cwd(),settings:{next:{rootDir}}}))}; }
  catch(e) { return {error:e.name,message:e.message}; }
}
try {
  for (const dir of ['apps/site/nested/deeper','apps/admin','apps/other','apps/site space/child','apps/.hidden','apps/1','apps/2','apps/3','apps/01','apps/02','apps/03','apps/{site,admin}','apps/${site,admin}','apps/Z','apps/a','apps/[','apps/]/nested']) fs.mkdirSync(path.join(fixture,dir),{recursive:true});
  fs.writeFileSync(path.join(fixture,'apps/site/file.txt'),'fixture');
  fs.symlinkSync(path.join(fixture,'apps/site'),path.join(fixture,'apps/link'),process.platform==='win32'?'junction':'dir');
  process.chdir(fixture);
  const results=cases.map(input=>{
    const expected=run(original,input),actual=run(candidate,input);
    return {input,expected,actual,pass:JSON.stringify(expected)===JSON.stringify(actual)};
  });
  console.log(JSON.stringify({platform:process.platform,node:process.version,baseline:'fast-glob@3.3.1',candidate:kind==='tiny'?'tinyglobby@0.2.17 adapter':'brace-expansion@5.0.12 + picomatch@2.3.2 + fill-range@7.1.1 adapter',results},null,2));
  process.exitCode=results.every(r=>r.pass)?0:1;
} finally {
  process.chdir(cwd);
  if(path.dirname(fixture)!==os.tmpdir() || !path.basename(fixture).startsWith('responseos-expanded-glob-')) throw Error('Unsafe fixture');
  fs.rmSync(fixture,{recursive:true});
}
