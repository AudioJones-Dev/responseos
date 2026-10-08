import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {acceptance} from './braces-acceptance.mjs';
function find(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?find(path.join(dir,item.name)):item.name==='verification-report.json'?[path.join(dir,item.name)]:[]);}
const paths=find('downloaded-evidence');
for(const file of paths){const dir=path.dirname(file);const index=JSON.parse(fs.readFileSync(path.join(dir,'evidence-index.json')));if(!Array.isArray(index)||!index.some(entry=>entry.file==='verification-report.json'))throw new Error('Missing evidence inventory');for(const entry of index){const target=path.resolve(dir,entry.file);if(!target.startsWith(path.resolve(dir)+path.sep)||crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==entry.sha256)throw new Error('Evidence hash mismatch');}}
const expectedToolHash=crypto.createHash('sha256').update(['scripts/security','docs/security/fixtures'].flatMap(dir=>fs.readdirSync(dir).filter(name=>dir.includes('fixtures')||name.endsWith('.mjs')).sort().map(name=>dir+'/'+name+'\n'+fs.readFileSync(dir+'/'+name,'utf8').replaceAll('\r\n','\n'))).join('\n')).digest('hex');
const reports=paths.map(file=>JSON.parse(fs.readFileSync(file)));
const win=reports.find(row=>row.platform==='win32'),linux=reports.find(row=>row.platform==='linux');
const results=[win,linux].map(row=>acceptance({...row,jobs:{...row?.jobs,windows:win?.jobs.windows,linux:linux?.jobs.linux,integration:process.env.INTEGRATION_RESULT}}));
if(reports.length!==2||!win||!linux||win.toolHash!==expectedToolHash||win.applicationSha!==linux.applicationSha||win.applicationSha!==process.env.SECURITY_APPLICATION_SHA||win.toolHash!==linux.toolHash)results.push({pass:false,failures:['missing-or-inconsistent-platform-evidence']});
console.log(JSON.stringify(results,null,2));
process.exitCode=results.every(result=>result.pass)?0:1;
