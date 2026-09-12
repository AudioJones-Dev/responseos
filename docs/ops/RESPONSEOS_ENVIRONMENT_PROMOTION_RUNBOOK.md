# ResponseOS — Environment Promotion Runbook

**Contract:** ResponseOS Environment Contract v1

**Status:** Repository governance and planning tooling

**Scope:** Configuration semantics, resource identity metadata, secret metadata, promotion policy, configuration certification, and future drift detection
**Does not authorize:** resource provisioning, secret installation, workflow dispatch, migration, deployment, domain/alias changes, phone routing, provider activation, prospect exposure, customer activation, or Production promotion

## 1. Governing sequence

Production is never recreated from memory or cloned blindly from staging. The only allowed sequence is:

```text
CERTIFIED CONFIGURATION CONTRACT
  → PRODUCTION PROMOTION PLAN
  → PROVISION NEW RESOURCES
  → INSTALL ENVIRONMENT-SPECIFIC SECRETS
  → READBACK
  → DIFF
  → CERTIFY
  → HUMAN APPROVAL
  → DEPLOY
```

Each arrow is a gate. Completing one stage grants no authority for the next.

## 2. Sources of truth

| Artifact | Purpose |
|---|---|
| [`infra/environments/schema/environment-contract.schema.json`](../../infra/environments/schema/environment-contract.schema.json) | Versioned runtime/resource/deployment-control contract |
| [`infra/environments/schema/secret-contract.schema.json`](../../infra/environments/schema/secret-contract.schema.json) | Secret names and handling metadata; never values |
| [`infra/environments/schema/certification-record.schema.json`](../../infra/environments/schema/certification-record.schema.json) | Configuration-certification evidence contract |
| [`infra/environments/schema/promotion-policy.schema.json`](../../infra/environments/schema/promotion-policy.schema.json) | Exactly-one classification rule contract |
| [`infra/environments/staging/environment.json`](../../infra/environments/staging/environment.json) | Canonical certified staging configuration |
| [`infra/environments/staging/secret-contract.json`](../../infra/environments/staging/secret-contract.json) | Staging application/runtime and workflow-control metadata |
| [`infra/environments/staging/certification.json`](../../infra/environments/staging/certification.json) | Configuration-only certification record |
| [`infra/environments/production/environment.template.json`](../../infra/environments/production/environment.template.json) | Production invariants plus unresolved Production identities |
| [`infra/environments/production/secret-contract.json`](../../infra/environments/production/secret-contract.json) | Production secret-creation requirements |
| [`infra/environments/promotion/staging-to-production.rules.json`](../../infra/environments/promotion/staging-to-production.rules.json) | `MUST_MATCH`, `MUST_DIFFER`, and `HUMAN_APPROVAL_REQUIRED` policy |

The schemas use v1 identifiers only:

- `responseos.environment.v1`
- `responseos.environment-certification.v1`
- `responseos.secret-contract.v1`
- `responseos.promotion-policy.v1`

Readers must reject unknown versions. Additive backward-compatible changes require optional fields only. Any new required meaning or changed invariant requires a reviewed version decision; do not introduce v2 until a real incompatibility exists.

## 3. Certified staging baseline

The canonical staging record is configuration evidence, not deployment evidence.

| Evidence | Certified value |
|---|---|
| Workflow | `Verify Staging Configuration` |
| Workflow run | [`32586167278`](https://github.com/AudioJones-Dev/responseos/actions/runs/32586167278) |
| Workflow-control SHA | `6202da68cb9b517b39814bab5b1542fd65adae22` |
| Reserved reviewed application SHA | `4a5b29b83cb3f18137b0151ae6242b2ac484ef08` |
| Certification type | `configuration` |

The certification timestamp was not recoverable from the repository-controlled evidence used for v1, so `certifiedAt` is explicitly `null` and listed as unresolved. The run ID, SHAs, identities, checks, and fingerprints are recorded without inventing a timestamp.

## 4. Separation of concerns

The contract keeps five classes separate:

1. **Configuration semantics** — Node major, auth-required behavior, pooled/direct database roles, exact-SHA controls, health/readback rules, fail-closed provider gates.
2. **Environment resource identity** — Vercel, Neon, Clerk, domains, phone numbers, and provider resources unique to one environment.
3. **Secret metadata** — name, classification, requirement, scope, provider owner, exposure, rotation, transfer prohibition, and activation effect.
4. **Secret values** — protected-store material that never enters Git, contract hashes, diffs, plans, logs, or certification records.
5. **Certification evidence** — exact workflow, run, source SHA, checks, non-secret references, and canonical fingerprints.

Application runtime variables and GitHub/CI workflow-control secrets are separate `scope` values in the secret contracts. A workflow credential is never treated as an application binding.

## 5. Canonical hashing

[`scripts/config/environment-contract.mjs`](../../scripts/config/environment-contract.mjs) recursively sorts object keys, preserves array order, serializes without insignificant whitespace, and hashes the UTF-8 canonical JSON with SHA-256.

```text
responseos.environment.v1
sha256:<64 lowercase hexadecimal characters>
```

Two fingerprints are recorded:

- **environment contract hash** — canonical `environment.json` only;
- **configuration hash** — canonical `{ environment, secretContract }`, containing secret metadata only.

Formatting, whitespace, and object-key order do not change the digest. Array order remains meaningful. No secret value is accepted into a hash input.

## 6. Capture and validate

The capture tool accepts repository-controlled JSON/readback fixtures only. It contains no Vercel, Neon, Clerk, Telnyx, HubSpot, or other network client.

```powershell
node scripts/config/capture-environment.mjs <readback-fixture.json> <environment.json>
npm run config:validate
```

Validation fails closed on:

- JSON Schema errors or unknown schema versions;
- malformed or unresolved fields in a governed Production contract;
- credential-like values or credential-bearing connection strings;
- duplicate policy paths or unclassified environment fields;
- Production development/test auth posture;
- `RESPONSEOS_DEV_SESSION` in the Production secret contract;
- missing pooled/direct separation;
- provider activation without explicit provider and live-execution approvals;
- certification hashes or duplicated environment/SHA metadata that do not match their canonical artifacts.

## 7. Promotion classifications

Every governed leaf in the staging environment contract has exactly one rule. Duplicate rules for the same path fail validation.

### MUST_MATCH

Includes schema/contract version, Node major, package-manager contract, migration lineage and policy, Vercel team ownership, manual-only and automatic-Git-disabled deployment controls, Deployment Protection, Neon provider and pooled/direct architecture, Clerk provider and fail-closed auth semantics, exact-SHA architecture, separate control/application SHA architecture, non-cancelling concurrency, promotion sequence, health/identity validation, rollback policy, configuration certification, provider activation-gate architecture, and the no-secret-values-in-Git rule.

### MUST_DIFFER

Includes environment name/class, Vercel project ID/name, Vercel custom-environment ID/slug/type, Neon project ID/name, branch ID, endpoint ID, Clerk provider/credential class, and the Production concurrency-group identity. Production secret metadata separately marks database credentials, Clerk credentials, webhook secrets, provider credentials, provider encryption keys, and project-scoped workflow credentials as independently provisioned.

### HUMAN_APPROVAL_REQUIRED

Includes Production alias/domain policy, exact Production control/application SHA selection, provider execution posture, credential allowance, enabled providers, provider approval state, Production domain activation, Telnyx activation, HubSpot live writes, phone assignment, recording, public demo/prospect exposure, customer activation, retention changes, Production promotion, and live-provider execution.

## 8. Diff behavior

After resources and protected-store bindings exist, capture a fresh non-secret Production readback into a governed `environment.json`, validate it, then compare it:

```powershell
node scripts/config/diff-environments.mjs `
  infra/environments/staging/environment.json `
  infra/environments/production/environment.json `
  infra/environments/promotion/staging-to-production.rules.json
```

Output categories:

| Status | Meaning | Exit effect |
|---|---|---|
| `MATCH` | A `MUST_MATCH` invariant is equal | pass |
| `EXPECTED_DIFFERENCE` | A `MUST_DIFFER` identity is independently resolved | pass |
| `MISSING` | A required comparable field is unresolved | fail |
| `UNAUTHORIZED_DIFFERENCE` | A `MUST_MATCH` changed or a `MUST_DIFFER` identity was reused | fail |
| `HUMAN_APPROVAL_REQUIRED` | An operator-held gate remains visible | does not imply approval |

The renderer prints labels and JSON-pointer paths only. It never prints compared values.
Both environments must pass the full semantic contract before classification begins. A schema-valid but forbidden authentication or provider posture fails instead of being rendered as promotion-safe; a semantically valid human-held decision remains `HUMAN_APPROVAL_REQUIRED`.

## 9. Build the Production plan

```powershell
npm run config:plan:production
```

The command resolves `secret-contract.json` and `certification.json` beside the source staging environment. It validates the exact source environment, secret metadata, certification hashes, certification metadata, and `CONFIGURATION_CERTIFIED` status before producing a plan. The deterministic plan records only non-secret source fingerprints plus the certification workflow, run ID, and control SHA; it does not copy certification timestamps or claim that the plan is certified.

The plan identifies unresolved resources, invariants, identities that must differ, independently created Production secret names, human approvals, and certification checks. It is planning-only and explicitly forbids resource creation, secret installation, workflow dispatch, deployment, provider activation, and domain/phone assignment.

Provisioning remains a separate operator/platform action. After provisioning, install Production-specific values through the approved platform stores. Never copy staging database URLs, Clerk keys, webhook secrets, provider keys, bypass secrets, signing/private keys, phone resources, or provider encryption keys.

## 10. Production readback and certification

Future Production certification must:

1. read the exact Production Vercel, Neon, Clerk class, deployment-control, and provider-gate metadata;
2. normalize only allowlisted non-secret fields;
3. validate the Production contract and secret metadata;
4. diff against the certified staging contract and v1 policy;
5. require zero `MISSING` and zero `UNAUTHORIZED_DIFFERENCE` results;
6. generate environment and combined configuration fingerprints;
7. record exact control/application SHAs and non-secret evidence references;
8. state `certificationType: configuration`;
9. require a separate human Production-promotion approval;
10. keep deploy as the final, separately authorized action.

Certification never proves application behavior, customer readiness, provider readiness, legal approval, or deployment success.

## 11. Future drift detection

Live polling is intentionally not implemented in v1. A future scheduled/read-only command may expose:

```text
responseos config drift production
```

Equivalent implementation sequence:

```text
CERTIFIED BASELINE
  vs
CURRENT ALLOWLISTED ENVIRONMENT READBACK
  → normalize
  → validate
  → canonical hash
  → classified diff
```

Expected states:

- `PASS` — no unauthorized configuration difference;
- `WARN` — only human-approved/pending differences;
- `FAIL` — missing requirement, resource reuse, secret leakage, invalid posture, or unauthorized drift.

The future job must be read-only, use least-privilege protected credentials, emit no secret values, upload only non-secret evidence, and never remediate drift automatically.

## 12. Prospect promotion remains separate

`prospect-promotion.v1` promotes reviewed business/customer state. `responseos.environment.v1` governs infrastructure/runtime configuration. They are not interchangeable and must not be merged.

```text
CERTIFIED PRODUCTION ENVIRONMENT
  + APPROVED CLIENT PROMOTION MANIFEST
  = ACTIVATABLE CLIENT INSTANCE
```

The equation expresses prerequisites, not activation authority. Existing prospect-promotion protections continue to forbid credentials, raw webhook bodies, caller data, transcripts, recordings, and unapproved facts. Environment certification does not import a client; client-manifest approval does not provision or certify infrastructure.

## 13. Human stop points

Stop for explicit operator approval before provisioning Production resources, installing or rotating credentials, enabling any provider, assigning domains or phone numbers, changing retention/recording, creating a Production certification workflow, promoting Production, deploying, exposing prospects, or activating customers.

This v1 repository implementation performs none of those actions.
