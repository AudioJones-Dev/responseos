import { createRequire } from 'node:module';
import path from 'node:path';
const load = createRequire(path.resolve('package.json'));
const mm = load('micromatch');
const original = mm.braces;
let calls = [];
mm.braces = (pattern, options) => { calls.push({pattern, options}); return original(pattern, options); };
const {getRootDirs} = load('@next/eslint-plugin-next/dist/utils/get-root-dirs');
const cases = [
  {name:'rootDir unset',settings:{}},
  {name:'literal trusted root',settings:{next:{rootDir:'app'}}},
  {name:'benign configured alternatives',settings:{next:{rootDir:'{app,lib}'}}},
];
const results = cases.map(test => {
  calls=[];
  const roots=getRootDirs({cwd:process.cwd(),settings:test.settings});
  return {...test,roots,calls:structuredClone(calls)};
});
mm.braces=original;
console.log(JSON.stringify({capturedAt:new Date().toISOString(),node:process.version,platform:process.platform,plugin:load('@next/eslint-plugin-next/package.json').version,fastGlob:load('fast-glob/package.json').version,micromatch:load('micromatch/package.json').version,braces:load('braces/package.json').version,scope:'benign root-discovery probe on isolated master install, not full PR195 execution',results},null,2));
