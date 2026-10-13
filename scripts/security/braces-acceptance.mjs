export function acceptance(evidence){
 const failures=[];
 if(evidence.runtimeNativePass!==true)failures.push('native-packaging-evidence');
 if(evidence.auditExit!==0||evidence.auditTotal!==0)failures.push('complete-dependency-security');
 for(const [name,total]of Object.entries({original:49,directory:441,tasks:584})){
  const result=evidence.compatibility?.[name];if(!result||result.total!==total||result.pass!==total||result.exit!==0)failures.push('compatibility-'+name);
 }
 if(evidence.candidateInstalled!==true)failures.push('implementation-not-linked-to-audited-graph');
 if(evidence.closurePass!==true)failures.push('packaging-closure');
 for(const name of ['windows','linux','integration','hostile','diagnostics'])if(evidence.jobs?.[name]!=='success')failures.push(name+'-evidence');
 if(!/^[0-9a-f]{40}$/.test(evidence.applicationSha||'')||evidence.applicationSha!==evidence.auditSha||evidence.applicationSha!==evidence.compatibilitySha)failures.push('identity-mismatch');
 return {pass:failures.length===0,failures};
}
