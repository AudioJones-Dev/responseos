import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { requireToolingInstallation, validateToolchain, lockedTools, verifyToolArchive, verifyInstalledTools } from "@/scripts/qualification-tooling.mjs";
import { validateQualificationPreflight } from "@/scripts/live-demo-commissioning-contract.mjs";

test('tooling installation fails closed without both activation and separate install approval', () => {
  for (const policy of [undefined, {}, {enabled:true}, {enabled:false,toolingInstallationApproved:true}, {enabled:true,toolingInstallationApproved:true}]) expect(()=>requireToolingInstallation(policy)).toThrow();
  expect(()=>requireToolingInstallation({enabled:true,toolingInstallationApproved:true,approvalReference:'synthetic'})).not.toThrow();
  expect(validateToolchain({node:'v24.18.0',npm:'11.16.0',vercel:'41.7.0'})).toEqual([]);
  for(const key of ['node','npm','vercel']) expect(validateToolchain({node:'v24.18.0',npm:'11.16.0',vercel:'41.7.0',[key]:'unknown'})).toEqual([`${key}_version_mismatch`]);
});

test('CLI token travels only over stdin, never OS arguments, inherited environment or an auth file', () => {
  const root=mkdtempSync(join(tmpdir(),'qualification-cli-'));
  try {
    mkdirSync(join(root,'scripts')); mkdirSync(join(root,'.qualification-tools/node_modules/vercel/dist'),{recursive:true});
    for(const name of ['qualification-cli.mjs','qualification-tooling.mjs']) copyFileSync(`scripts/${name}`,join(root,'scripts',name));
    writeFileSync(join(root,'.qualification-tools/node_modules/vercel/package.json'),JSON.stringify({version:'41.7.0'}));
    writeFileSync(join(root,'.qualification-tools/node_modules/vercel/dist/index.js'),`const fs=require('node:fs'); const token=process.argv.at(-1); const osArgs=process.platform==='linux'?fs.readFileSync('/proc/self/cmdline','utf8'):''; console.log(JSON.stringify({received:token==='synthetic-pipe-only',environment:!!process.env.VERCEL_TOKEN,osArgumentsContainToken:osArgs.includes(token)}));`);
    mkdirSync(join(root,'infra/qualification-toolchain'),{recursive:true});
    mkdirSync(join(root,'.qualification-tools/node_modules/npm/bin'),{recursive:true});
    writeFileSync(join(root,'.qualification-tools/node_modules/npm/package.json'),JSON.stringify({version:'11.16.0'}));
    writeFileSync(join(root,'.qualification-tools/node_modules/npm/bin/npm-cli.js'),'synthetic npm entrypoint');
    for(const file of ['package.json','package-lock.json']) copyFileSync(`infra/qualification-toolchain/${file}`,join(root,'infra/qualification-toolchain',file));
    copyFileSync('infra/qualification-toolchain/package-lock.json',join(root,'.qualification-tools/package-lock.json'));
    const manifest=JSON.parse(readFileSync('infra/qualification-toolchain/integrity.json','utf8'));
    for(const entry of Object.keys(manifest.entrypoints)) manifest.entrypoints[entry]=createHash('sha256').update(readFileSync(join(root,'.qualification-tools',entry))).digest('hex');
    writeFileSync(join(root,'infra/qualification-toolchain/integrity.json'),JSON.stringify(manifest));
    const args=[join(root,'scripts/qualification-cli.mjs'),'--version'];
    const result=spawnSync(process.execPath,args,{input:'synthetic-pipe-only',env:{NODE_ENV:"test",SystemRoot:process.env.SystemRoot},encoding:'utf8'});
    if(process.version==='v24.18.0') {
      expect(result.status).toBe(0); expect(JSON.parse(result.stdout)).toEqual({received:true,environment:false,osArgumentsContainToken:false});
    } else expect(result.status).toBe(1);
    expect(args.join(' ')).not.toContain('synthetic-pipe-only'); expect(result.stderr).not.toContain('synthetic-pipe-only');
    const runner=readFileSync('scripts/run-qualification-deployment.mjs','utf8');
    expect(runner).not.toContain('[...args, "--token"');
    expect(runner).toContain('}, env.VERCEL_TOKEN)');
    writeFileSync(join(root,'.qualification-tools/node_modules/npm/bin/npm-cli.js'),'tampered');
    expect(()=>verifyInstalledTools(root)).toThrow('tool_entrypoint_integrity_mismatch');
  } finally { rmSync(root,{recursive:true,force:true}); }
});

test('all locked registry dependencies carry integrity and altered lock bytes fail closed', () => {
  expect(Object.keys(lockedTools(process.cwd()).lock.packages).length).toBeGreaterThan(300);
  const root=mkdtempSync(join(tmpdir(),'tool-lock-'));
  try {
    mkdirSync(join(root,'infra/qualification-toolchain'),{recursive:true});
    for(const file of ['package.json','package-lock.json','integrity.json']) copyFileSync(`infra/qualification-toolchain/${file}`,join(root,'infra/qualification-toolchain',file));
    writeFileSync(join(root,'infra/qualification-toolchain/package-lock.json'),'{}');
    expect(()=>lockedTools(root)).toThrow('tool_lock_integrity_mismatch');
  } finally { rmSync(root,{recursive:true,force:true}); }
});

test('bootstrap rejects corrupt bytes before extraction or execution and workflow pins verified action', () => {
  const bytes=Buffer.from('synthetic archive');
  const integrity='sha512-'+createHash('sha512').update(bytes).digest('base64');
  expect(()=>verifyToolArchive(bytes,integrity)).not.toThrow();
  expect(()=>verifyToolArchive(Buffer.from('corrupt'),integrity)).toThrow('tool_archive_integrity_mismatch');
  const workflow=readFileSync('.github/workflows/deploy-live-demo.yml','utf8');
  expect(workflow).toContain('actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38');
  expect(workflow).not.toContain('actions/setup-node@v6');
  const installer=readFileSync('scripts/install-qualification-tools.mjs','utf8');
  expect(installer.indexOf('requireToolingInstallation(JSON')).toBeLessThan(installer.indexOf('await fetch'));
  expect(installer.indexOf('verifyToolArchive(archive')).toBeLessThan(installer.indexOf('command("/usr/bin/tar"'));
  expect(installer).toContain('"ci", "--prefix"');
  expect(installer).not.toContain('"install"');
});

const env={RESPONSEOS_WEBHOOK_FINGERPRINT_KEY_ID:'synthetic-local-v1',RESPONSEOS_WEBHOOK_FINGERPRINT_KEYS_JSON:JSON.stringify({'synthetic-local-v1':'42'.repeat(32)}),RESPONSEOS_WEBHOOK_FINGERPRINT_RETENTION_SECONDS:'86400',RESPONSEOS_DEPLOYMENT_LANE:'live-demo',RESPONSEOS_REQUIRE_AUTH:'true',CLERK_SECRET_KEY:'sk_test_synthetic',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'pk_test_synthetic',CLERK_WEBHOOK_SECRET:'whsec_synthetic',AJ_DIGITAL_CLERK_ORG_ID:'org_synthetic',RESPONSEOS_LIVE_HUBSPOT_ENABLED:'false',RESPONSEOS_LIVE_EMAIL_ENABLED:'false',RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED:'true',TELNYX_API_KEY:'synthetic',TELNYX_PUBLIC_KEY:'synthetic'};
const evidence={consent:{recording:{enabled:false}},qualificationAssignmentActive:true,crmEmailPermanentlyBlocked:true};
test('trusted carrier mode is explicit and cannot enable CRM, email, recording or other modes', () => {
  expect(validateQualificationPreflight(env,evidence,'carrier-qualification')).toEqual([]);
  for(const mode of [undefined,'','carrier','unknown','offline']) expect(validateQualificationPreflight(env,evidence,mode).length).toBeGreaterThan(0);
  for(const name of ['TELNYX_API_KEY','TELNYX_PUBLIC_KEY','RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED']) expect(validateQualificationPreflight({...env,[name]:''},evidence,'carrier-qualification').length).toBeGreaterThan(0);
  for(const name of ['RESPONSEOS_LIVE_HUBSPOT_ENABLED','RESPONSEOS_LIVE_EMAIL_ENABLED']) expect(validateQualificationPreflight({...env,[name]:'true'},evidence,'carrier-qualification').length).toBeGreaterThan(0);
  expect(validateQualificationPreflight(env,{...evidence,consent:{recording:{enabled:true}}},'carrier-qualification').length).toBeGreaterThan(0);
});
