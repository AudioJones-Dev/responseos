import {PrismaClient} from '@prisma/client';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {persistHostedIntake} from '../lib/routing/ledger';
import {runWorkerBatch} from '../lib/routing/worker';
import {SimulatedRoutingProvider} from '../lib/routing/simulatedProvider';
import {payload} from '../tests/routingFixtures';
async function main() {
 const source = new URL(process.env.DATABASE_URL ?? '');
 if (!['127.0.0.1','localhost'].includes(source.hostname) || source.port !== '55440') throw new Error('local_owned_validation_only');
 const db = new PrismaClient();
 const tenant='frl_routing_staging_synthetic';
 let worker: PrismaClient | undefined;
 try {
  const sql=JSON.parse(await readFile('infra/routing/worker-permissions.review.json','utf8')).statements as string[];
  const prior=await db.$queryRaw<{exists:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='responseos_routing_worker_test')`;
  for (const statement of prior[0].exists ? sql.filter(s=>s.includes('REVOKE TEMPORARY')) : sql) await db.$executeRawUnsafe(statement);
  await db.account.upsert({where:{id:tenant},update:{},create:{id:tenant,slug:tenant,name:'Synthetic permission test',industry:'test',timezone:'UTC'}});
  const id=randomUUID();
  await persistHostedIntake(db,{accountId:tenant,keyId:'local-role-review',environment:'test',audience:'local-role-review',retentionDays:7},id,payload('residential',id));
  const url=new URL(source);url.searchParams.set('options','-c role=responseos_routing_worker_test');
  worker=new PrismaClient({datasources:{db:{url:url.toString()}}});
  const identity=await worker.$queryRaw<{current_user:string}[]>`SELECT current_user`;
  if(identity[0]?.current_user!=='responseos_routing_worker_test')throw new Error('role_not_effective');
  const rows=await worker.account.findMany({select:{id:true}});
  if(rows.length!==1 || rows[0].id!==tenant)throw new Error('tenant_leak');
  const outcomes=await runWorkerBatch(worker,tenant,'test',new SimulatedRoutingProvider(),1);
  if(outcomes[0]!=='confirmed')throw new Error(`positive_worker_failed:${outcomes}`);
  const denied=[`UPDATE public."Account" SET id=id WHERE id='${tenant}'`, `DELETE FROM public."HostedRoutingDelivery" WHERE account_id='${tenant}'`,`SELECT * FROM public."User"`,`CREATE ROLE routing_forbidden`,`ALTER TABLE public."HostedRoutingDelivery" ADD COLUMN forbidden text`,`CREATE TEMP TABLE routing_forbidden_temp (id text)`];
  for(const statement of denied){let rejected=false;try{await worker.$executeRawUnsafe(statement);}catch{rejected=true;}if(!rejected)throw new Error('negative_probe_accepted');}
  const unrelated=await worker.frlWebIntake.count({where:{account_id:'org_mock_1'}});
  if(unrelated!==0)throw new Error('cross_tenant_read');
  console.log(JSON.stringify({localOnly:true,effectiveRole:identity[0].current_user,worker:outcomes,negativeProbes:denied.length,crossTenantRows:unrelated,hostedApplied:false}));
 } finally {await worker?.$disconnect();await db.$disconnect();}
}
void main();
