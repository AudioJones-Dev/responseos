import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const integrationCommands=[
 ['install','npm',['ci','--include=dev','--no-fund']],
 ['generate','prisma',['generate']],
 ['server-version','psql',['-h','localhost','-U','responseos','-d','responseos_test','-Atc','SHOW server_version_num;']],
 ['shadow','psql',['-h','localhost','-U','responseos','-d','responseos_test','-c','CREATE DATABASE responseos_shadow;']],
 ['diff','prisma',['migrate','diff','--from-schema-datamodel','prisma/schema.prisma','--to-migrations','prisma/migrations','--shadow-database-url','postgresql://responseos:responseos@localhost:5432/responseos_shadow','--exit-code']],
 ['migrate','prisma',['migrate','deploy']],
 ['seed','prisma',['db','seed']],
 ['integration','npm',['run','test:integration']],
 ['build','npm',['run','build']],
];
export function verifyIntegration(report,read,applicationSha,toolHash,sourceHashes){
 if(report.applicationSha!==applicationSha||report.toolHash!==toolHash||report.platform!=='linux'||report.node!=='v24.18.0'||report.npm!=='11.16.0'||report.postgresMajor!==16||report.complete!==true)throw Error('Integration identity or completion mismatch');
 for(const name of ['package.json','package-lock.json'])if(!/^[0-9a-f]{64}$/.test(sourceHashes?.[name]||'')||report.sourceHashes?.[name]!==sourceHashes[name]||report.finalHashes?.[name]!==sourceHashes[name])throw Error('Integration exact-lock mismatch');
 if(!Array.isArray(report.steps)||report.steps.length!==integrationCommands.length)throw Error('Integration command coverage incomplete');
 for(const [i,[name,tool,args]]of integrationCommands.entries()){
  const row=report.steps[i],raw=read(name+'-result.json');
  if(row.name!==name||JSON.stringify(raw)!==JSON.stringify(row)||row.tool!==tool||JSON.stringify(row.args)!==JSON.stringify(args)||row.exit!==0||row.signal!==null||row.timedOut!==false||!Number.isFinite(Date.parse(row.startedAt))||!Number.isFinite(Date.parse(row.finishedAt))||Date.parse(row.finishedAt)<Date.parse(row.startedAt))throw Error('Integration command evidence mismatch: '+name);
  const log=read(name+'.log',false);
  if(name==='server-version'&& !/^16\d{4}\s*$/.test(log.trim()))throw Error('Postgres 16 not demonstrated');
 }
 return true;
}
async function runIntegration(){
 const root=process.cwd(),app=path.resolve('application'),dir=path.resolve('.security-integration');fs.mkdirSync(dir,{recursive:true});
 const hash=data=>crypto.createHash('sha256').update(data).digest('hex'),sha=process.env.SECURITY_APPLICATION_SHA,npm=process.env.SECURITY_NPM_CLI;
 const report={applicationSha:sha,platform:process.platform,node:process.version,steps:[],complete:false},save=()=>fs.writeFileSync(path.join(dir,'integration-report.json'),JSON.stringify(report,null,2)+'\n');
 try{
  if(process.platform!=='linux'||process.version!=='v24.18.0'||!/^[0-9a-f]{40}$/.test(sha||'')||!npm)throw Error('Pinned Linux source and tools required');
  report.toolHash=(await import('./braces-ci-accept.mjs')).toolingHash(root);
  const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','LC_ALL'].filter(name=>process.env[name]).map(name=>[name,process.env[name]]));
  Object.assign(env,{NODE_ENV:'test',NEXT_TELEMETRY_DISABLED:'1',RESPONSEOS_REQUIRE_AUTH:'true',PGPASSWORD:'responseos',DATABASE_URL:'postgresql://responseos:responseos@localhost:5432/responseos_test',DIRECT_URL:'postgresql://responseos:responseos@localhost:5432/responseos_test',npm_config_userconfig:path.join(dir,'empty.npmrc')});fs.writeFileSync(env.npm_config_userconfig,'');
  report.npm=spawnSync(process.execPath,[npm,'--version'],{env,encoding:'utf8'}).stdout?.trim();if(report.npm!=='11.16.0')throw Error('npm mismatch');
  report.sourceHashes={};
  for(const name of ['package.json','package-lock.json']){
   const expected=spawnSync('git',['show',sha+':'+name],{cwd:root,env,maxBuffer:20000000});if(expected.status!==0)throw Error('Source blob unavailable');
   report.sourceHashes[name]=hash(expected.stdout);if(hash(fs.readFileSync(path.join(app,name)))!==report.sourceHashes[name])throw Error('Export differs from source');
  }
  save();
  for(const [name,tool,args]of integrationCommands){
   const startedAt=new Date().toISOString(),exe=tool==='psql'?'psql':process.execPath,argv=tool==='npm'?[npm,...args]:tool==='prisma'?[path.join(app,'node_modules/prisma/build/index.js'),...args]:args;
   const result=spawnSync(exe,argv,{cwd:app,env,encoding:'utf8',timeout:900000,maxBuffer:50000000});
   const log=(result.stdout||'')+(result.stderr||'');fs.writeFileSync(path.join(dir,name+'.log'),log);
   const row={name,tool,args,exe,argv,startedAt,finishedAt:new Date().toISOString(),exit:result.status,signal:result.signal||null,timedOut:result.error?.code==='ETIMEDOUT',error:result.error?.message||null};report.steps.push(row);fs.writeFileSync(path.join(dir,name+'-result.json'),JSON.stringify(row,null,2)+'\n');save();
   if(result.status!==0||row.timedOut)throw Error('Integration command failed: '+name);
   if(name==='server-version'){if(!/^16\d{4}\s*$/.test(log.trim()))throw Error('Postgres 16 required');report.postgresMajor=16;}
  }
  report.finalHashes=Object.fromEntries(['package.json','package-lock.json'].map(name=>[name,hash(fs.readFileSync(path.join(app,name)))]));report.complete=true;
  verifyIntegration(report,(name,json=true)=>json?JSON.parse(fs.readFileSync(path.join(dir,name))):fs.readFileSync(path.join(dir,name),'utf8'),sha,report.toolHash,report.sourceHashes);
 }catch(error){report.complete=false;report.error=error.message;console.error(error.message);process.exitCode=1;}
 save();fs.writeFileSync(path.join(dir,'evidence-index.json'),JSON.stringify(fs.readdirSync(dir).filter(name=>name!=='evidence-index.json').sort().map(file=>({file,sha256:hash(fs.readFileSync(path.join(dir,file)))})),null,2)+'\n');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))runIntegration().catch(error=>{console.error(error.message);process.exitCode=1;});
