import crypto from 'node:crypto';

const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const escapeRegExp=text=>text.replace(/[.*+?^${}()|[\]\\/]/g,'\\$&');
const sharpSource=prefix=>new RegExp('^'+escapeRegExp(prefix)+'node_modules/sharp/dist/sharp\\.(cjs|mjs)$');
const selector='const runtimePlatform = runtimePlatformArch();';
const platformFlags='const [isLinux, isMacOs, isWindows] = ["linux", "darwin", "win32"].map((os) => runtimePlatform.startsWith(os));';
export const linuxGuardExpression='isLinux && /(symbol not found|CXXABI_)/i.test(messages)';

// The frozen ledger must be the committed, hash-pinned ledger for this build, and a traced build's own ledger must have exactly its rows.
export function verifyFrozenIdentity({traced,frozen,ledgerFile,ledgerBytes,ledger,fresh,build,node}){
 if(traced&&(typeof ledgerFile!=='string'||!ledgerFile.startsWith('docs/security/')||ledgerFile.includes('..')))throw new Error('Frozen ledger must be committed under docs/security');
 if(build.sourceCommit!==frozen.applicationSha||build.platform!==frozen.platform||node!==build.node||ledger.ledger.length!==frozen.occurrences||ledger.ledger.some((row,index)=>row.id!==index+1)||traced&&(hash(ledgerBytes)!==frozen.ledgerSha256||ledger.summary?.applicationSha!==frozen.applicationSha))throw new Error('Frozen occurrence identity mismatch');
 if(traced&&JSON.stringify(fresh?.ledger)!==JSON.stringify(ledger.ledger))throw new Error('Fresh ledger rows differ from the frozen ledger');
}

export function verifyFrozenRuntimePlatform({traced,frozen,selected}){
 if(traced&&frozen.runtimePlatform!==selected)throw new Error('Frozen runtime platform mismatch');
}

// A sharp `case` that the selected platform cannot take, where the selected platform has its own exact case and no default.
export function inactivePlatformBranch({file,text,guards,packaged,prefix,selected}){
 const guard=guards.find(item=>item.kind==='switch-case'&&item.discriminant==='runtimePlatform');
 const ownCase=new RegExp('case "'+escapeRegExp(selected)+'":\\s*sharp = require\\("@img/sharp-'+escapeRegExp(selected)+'/sharp\\.node"\\);\\s*break;');
 return packaged&&sharpSource(prefix).test(file)&&text.includes(selector)&&ownCase.test(text)&&guard&&!guard.labels.includes('"'+selected+'"')&&!guard.labels.includes('default')?guard:null;
}

// The isLinux true-branch, closed only for a selected platform that is not Linux (standalone: the two frozen Windows IDs).
export function inactiveLinuxGuard({id,file,text,guards,packaged,prefix,selected,traced}){
 const guard=guards.find(item=>item.kind==='if'&&item.branch==='true'&&item.expression===linuxGuardExpression);
 return packaged&&(traced||[116,134].includes(id))&&sharpSource(prefix).test(file)&&text.includes(selector)&&text.includes(platformFlags)&&guard&&(traced?!selected.startsWith('linux'):selected==='win32-x64')?guard:null;
}
