import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import {fileURLToPath} from 'node:url';
const base=fs.realpathSync(process.env.RESPONSEOS_PROBE_ROOT);
const log=process.env.RESPONSEOS_PROBE_LOG;
function record(event){fs.appendFileSync(log,JSON.stringify({time:new Date().toISOString(),...event})+'\n');}
function check(file){
 if(!path.isAbsolute(file)) return;
 const real=fs.realpathSync(file);
 if(real!==base&&!real.startsWith(base+path.sep)) {record({kind:'escape-blocked',file:real});throw new Error('Module resolved outside runtime package: '+real);}
}
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...rest){
 try{const file=resolve.call(this,request,parent,...rest);check(file);record({kind:'cjs-resolve',request,file});return file;}
 catch(error){record({kind:'cjs-failed',request,error:error.message});throw error;}
};
const load=Module._load;
Module._load=function(request,parent,...rest){const value=load.call(this,request,parent,...rest);record({kind:'cjs-loaded',request});return value;};
Module.registerHooks({
 resolve(specifier,context,nextResolve){const result=nextResolve(specifier,context);if(result.url.startsWith('file:'))check(fileURLToPath(result.url));record({kind:'esm-resolve',specifier,url:result.url});return result;},
 load(url,context,nextLoad){const result=nextLoad(url,context);record({kind:'esm-loaded',url});return result;}
});
record({kind:'hooks-ready',base,cjs:true,esm:true});
