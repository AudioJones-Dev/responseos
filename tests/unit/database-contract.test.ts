import { describe, expect, it } from "vitest";
import { validateDatabaseConnections, validateMigrationHistory, validateRestoreBindings } from "../../scripts/database-contract.mjs";

const target = { host: "ep-synthetic.us-east-1.aws.neon.tech", database: "synthetic", runtimeRole: "app", migrationRole: "migrator" };
const runtime = "postgresql://app:synthetic@ep-synthetic-pooler.us-east-1.aws.neon.tech/synthetic?sslmode=require&sslaccept=strict";
const migration = "postgresql://migrator:synthetic@ep-synthetic.us-east-1.aws.neon.tech/synthetic?sslmode=require&sslaccept=strict";
describe("database connection boundary", () => {
  it("accepts pooled runtime without migration credentials", () => expect(validateDatabaseConnections({DATABASE_URL:runtime},target)).toEqual([]));
  it("accepts a separate migration principal", () => expect(validateDatabaseConnections({DIRECT_URL:migration},target,"migration")).toEqual([]));
  it.each([
    runtime.replace("synthetic-pooler", "wrong-pooler"),
    runtime.replace("/synthetic?", "/production?"),
    runtime.replace("//app:", "//neondb_owner:"),
    runtime.replace("sslmode=require", "sslmode=disable"),
    runtime + "&sslaccept=accept_invalid_certs",
    runtime.replace("&sslaccept=strict", ""),
    runtime + "&sslmode=disable",
    runtime + "&options=-c%20role%3Dneondb_owner",
    runtime.replace("postgresql:", "https:"),
    runtime.replace("synthetic?", "synthetic#hidden"),
  ])("refuses wrong targets or insecure credentials without echoing the URL", (url) => {
    const errors=validateDatabaseConnections({DATABASE_URL:url},target);
    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).not.toContain(url);
  });
  it("refuses worker inheritance of the migrator URL", () => expect(validateDatabaseConnections({DATABASE_URL:runtime,DIRECT_URL:migration},target,"worker")).toContain("worker_migration_credential_present"));
  it("refuses process-wide TLS bypass", () => expect(validateDatabaseConnections({DATABASE_URL:runtime,NODE_TLS_REJECT_UNAUTHORIZED:"0"},target)).toContain("tls_verification_disabled"));
  it("refuses owner reuse through a malformed contract", () => expect(validateDatabaseConnections({}, {...target,migrationRole:"app"})).toEqual(["target_contract_incomplete"]));
});
describe("migration lineage", () => {
  const expected=[{name:"0001_base",checksum:"a"},{name:"0017_frl",checksum:"b"}];
  it("allows unapplied trailing migrations", () => expect(validateMigrationHistory([{...expected[0],finished:true,rolled_back:false}],expected)).toEqual([]));
  it("blocks the live-demo and FRL divergent 0017 histories", () => expect(validateMigrationHistory([{name:"0017_call_control",checksum:"c",finished:true,rolled_back:false}],expected)).toContain("applied_migration_absent_from_repository"));
  it.each(["false", undefined, null, 0])("rejects malformed rollback flags", (flag) => expect(validateMigrationHistory([{...expected[0],finished:true,rolled_back:flag}],expected)).toEqual(["migration_row_invalid"]));
  it("rejects malformed finished flags", () => expect(validateMigrationHistory([{...expected[0],finished:"true",rolled_back:false}],expected)).toEqual(["migration_row_invalid"]));
  it("blocks checksum drift and unfinished migration", () => expect(validateMigrationHistory([{name:"0001_base",checksum:"changed",finished:false,rolled_back:false}],expected)).toEqual(["unfinished_migration","migration_checksum_mismatch"]));
  it("rejects migrations applied out of repository order", () => expect(validateMigrationHistory([...expected].reverse().map(m=>({...m,finished:true,rolled_back:false})),expected)).toContain("migration_application_order_mismatch"));
  it("blocks missing earlier migrations", () => expect(validateMigrationHistory([{...expected[1],finished:true,rolled_back:false}],expected)).toContain("migration_history_gap"));
});
describe("restore binding incident regression", () => {
  const before={projectId:"p",defaultBranchId:"source",branches:[{id:"source",name:"main"}],endpoints:[{id:"app-endpoint",branchId:"source"}],connections:[{service:"web",endpointId:"app-endpoint",database:"db",role:"app"}]};
  const after={...before,branches:[...before.branches,{id:"clone",name:"restore"}],endpoints:[...before.endpoints,{id:"clone-endpoint",branchId:"clone"}]};
  const clone={branchId:"clone",endpointId:"clone-endpoint"};
  it("allows only a separate restore target", () => expect(validateRestoreBindings(before,after,clone)).toEqual([]));
  it("blocks the original endpoint being rebound to the clone", () => expect(validateRestoreBindings(before,{...after,endpoints:after.endpoints.map(e=>e.id==="app-endpoint"?{...e,branchId:"clone"}:e)},clone)).toContain("existing_endpoint_binding_changed"));
  it("blocks default branch swaps", () => expect(validateRestoreBindings(before,{...after,defaultBranchId:"clone"},clone)).toContain("project_or_default_branch_changed"));
  it("blocks application retargeting", () => expect(validateRestoreBindings(before,{...after,connections:[{...before.connections[0],endpointId:"clone-endpoint"}]},clone)).toContain("application_connection_changed"));
  it("requires names in both binding snapshots", () => expect(validateRestoreBindings({...before,branches:[{id:"source"}]},{...after,branches:[{id:"source"},{id:"clone",name:"restore"}]},clone)).toEqual(["binding_branch_name_missing"]));
  it("blocks incomplete inventories", () => expect(validateRestoreBindings({...before,connections:[]},after,clone)).toContain("binding_snapshot_incomplete"));
  it("blocks restore over the original branch", () => expect(validateRestoreBindings(before,after,{branchId:"source",endpointId:"app-endpoint"})).toContain("restore_target_not_separate"));
});
