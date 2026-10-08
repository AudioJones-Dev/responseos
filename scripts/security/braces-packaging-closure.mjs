import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
export function classify(reference,platform,config={}){
 const evidence={sourceHash:reference.sourceHash,line:reference.line,containingFunction:reference.containingFunction,context:reference.context,guards:reference.guards||[],input:reference.input};
 const value=reference.input;
 if(reference.literal&&value.startsWith('@img/sharp'))return {category:'platform-specific',closure:'UNKNOWN',reason:'Sharp fallback/native alternatives require branch selection and installed native target evidence',platform,evidence};
 if(reference.literal&&value.startsWith('react-server-dom-'))return {category:'framework-alias',closure:'UNKNOWN',reason:'React renderer alias must be linked to the emitted rendering runtime; plain require.resolve is insufficient',evidence};
 if(reference.literal&&['@opentelemetry/api','critters','private-next-instrumentation-client'].includes(value))return {category:'optional',closure:'UNKNOWN',reason:'Feature guard and optional failure handling must be verified for this occurrence',evidence};
 if(!reference.literal)return {category:'dynamic',closure:'UNKNOWN',reason:'Computed target requires enumeration or a demonstrated inactive configuration guard',config,evidence};
 return {category:'missing',closure:'FAIL',reason:'Literal external reference has no known mapping or optional/platform justification',evidence};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url))){
 const directory=path.resolve('.security-evidence/artifact-verification');
 const build=JSON.parse(fs.readFileSync(path.join(directory,'build-summary.json')));
 const rows=JSON.parse(fs.readFileSync(path.join(directory,'imports.json')));
 const runtime=JSON.parse(fs.readFileSync(path.join(directory,'runtime-summary.json')));
 const server=fs.readFileSync(path.join(build.checkout,'.next/standalone/server.js'),'utf8');
 const config=JSON.parse(/^const nextConfig = (.+)$/m.exec(server)[1]);
 const unresolved=rows.filter(row=>!row.literal||row.resolution==='unresolved-external');
 const ledger=unresolved.map((row,index)=>{
  const source=fs.readFileSync(path.join(build.checkout,row.file),'utf8');
  return {id:index+1,file:row.file,...classify({...row,sourceHash:hash(source)},process.platform,{cacheHandler:config.cacheHandler||null,cacheHandlers:config.cacheHandlers||null,adapterPath:config.adapterPath||null})};
 });
 const packages=JSON.parse(fs.readFileSync(path.join(directory,'inspection-summary.json'))).packages;
 const summary={capturedAt:new Date().toISOString(),applicationSha:build.sourceCommit,occurrences:ledger.length,groups:Object.fromEntries(['platform-specific','framework-alias','optional','dynamic','missing'].map(category=>[category,ledger.filter(row=>row.category===category).length])),unknown:ledger.filter(row=>row.closure==='UNKNOWN').length,missing:ledger.filter(row=>row.closure==='FAIL').length,packagingPass:ledger.every(row=>row.closure==='PASS')&&runtime.escapes.length===0,selectedNativePackages:packages.filter(pkg=>pkg.name?.startsWith('@img/')),limitations:['Classification is not closure: all unproven branch mappings remain UNKNOWN','Public/protected-denial probes cannot establish successful authenticated production execution']};
 fs.writeFileSync(path.join(directory,'closure-ledger.json'),JSON.stringify({summary,ledger},null,2)+'\n');
 console.log(JSON.stringify(summary));
}
