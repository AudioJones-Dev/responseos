# Telnyx agent reference and MCP evaluation

Status: DOCUMENTED_ONLY recommendation; evaluated 2026-09-24. No MCP configuration, credential access, provider mutation, runtime change, deployment, or activation accompanies this document.

## Task scope and decision

Problem: engineers and operators need current Telnyx schemas without moving deterministic telephony into an agent tool loop. Outcome: a canonical upstream reference, verified discovery evidence, and a bounded setup/runbook. Success means separating public discovery from authenticated account access, comparing an existing command with current schema, and preserving all runtime gates.

Scope: read-only repository/API research and this reference. Out of scope: runtime implementation, autonomous mutation, provisioning, secrets/configuration changes, live calls, and integration activation. Existing assets: ADR-0031/0038/0047/0048/0051/0055/0058, provider adapters, capability contracts, and PR #177. Plan: recon, public discovery, schema comparison, document limitations, then separately authorize authenticated discovery. Open questions: credential scope, account/environment ownership, MCP schema parity, and enforceable endpoint restrictions.

Recommended boundary: MCP is developer tooling now and a potential supervised operator interface later. It is not runtime infrastructure. Use Telnyx's hosted service rather than building another client or adding a runtime dependency. This reference belongs in the existing `docs/ops/` convention. It applies existing decisions rather than ratifying a new ADR or changing the roadmap.

## Repository findings and conflicts

The original clean checkout was `claude/supervised-frl-call-review-dc928d` at `a9747cceb87a62864c65801126ef8bf99a6c047f`. Remote master was verified at `724a3e5bb221ccbb7ab9a6f8e64a29ed06174746`; this documentation branch starts there. These are source snapshots, not deployed-state evidence.

| Area | Verified source and responsibility |
|---|---|
| Signed ingress | `app/api/webhooks/telnyx/calls/route.ts` and `assistant-initialization/route.ts`; feature gates, raw-body signature checks, server-owned destination/assignment resolution |
| Provider payload boundary | `lib/providers/telnyx/webhook.ts`, `normalize.ts`; Telnyx event envelopes/IDs and transcript/insight fields normalized into tenant records |
| Evidence and replay | `lib/data/webhookEvents.ts`; ingress ledger and duplicate/reprocessing handling; `lib/crm/syncFinalizedCall.ts` handles bounded downstream synchronization |
| Abstractions | `lib/providers/{carrier,voiceAgent,voice,sms,crm,scheduling}`; carrier factory remains mock-only, even though bounded Telnyx webhook paths exist |
| Operator layer | `/admin/demo-operations`, prospect bootstrap services, number-assignment ledger and `lib/prospectBootstrap/attestation.ts` |
| Provider provisioning | External operator provisioning/readback followed by signed attestation and internal registration; no Telnyx number-purchase/application-provisioning API writer found in inspected master `lib/` or `scripts/` |
| Capability system | Master `lib/capabilities/{contract,index,validate}.ts`: frozen descriptors and governance validation, not an execution service or generic tool registry; current triggers are `inbound_call` and `lead_form` |
| Existing tool policy | `lib/agentExecution/policy.ts`; allowed tools and execution modes. No Telnyx MCP runtime/client infrastructure found in master `lib/`, `app/`, `scripts/`, or `package.json` |
| Existing references | `docs/DECISIONS.md`, `docs/SECURITY.md`, `docs/product/responseos-communications-stack.md`, provider readiness and `docs/ops/` deployment runbooks |

[PR #177](https://github.com/AudioJones-Dev/responseos/pull/177), open at `c851940899e9758bfdc9b52758b1b80cc7407646`, adds `app/api/webhooks/telnyx/call-control/route.ts`, `lib/providers/telnyx/callControl.ts`, and `lib/callControl/service.ts`: explicit HTTP commands, durable command intent, capture state, consent/refusal/withdrawal and reconciliation. These are branch implementation, not merged-master or production claims. [PR #180](https://github.com/AudioJones-Dev/responseos/pull/180), open at `bc1c6269e9a5a60fcc688a03fb9f3fc7db6370d5`, changes Telnyx qualification scoring; #181 changes request validation. Preserve these efforts. Older roadmap prose does not establish current implementation status.

Telnyx-specific schemas are already consumed directly at webhook normalization and the PR #177 Call Control boundary. Generic interfaces do not mean all production paths are provider-independent.

## Upstream references

- [LLM reference corpus](https://telnyx.com/llms-full.txt): HTTP 200, approximately 147K characters in the observed response. Contains capabilities, compliance, SLA, resilience, methodology, pricing, benchmarks, compatibility and a categorized public-site index, with some categories delegated to scoped corpora. It is not a complete Voice API contract. Vendor assertions are reference material, not independent evidence of ResponseOS compliance or readiness.
- [Hosted MCP](https://api.telnyx.com/v2/mcp): POST JSON-RPC over Streamable HTTP; do not evaluate it through browser GET.
- Official client: `npx @telnyx/mcp`. npm metadata reported version `0.1.0`, repository `https://github.com/team-telnyx/ai`, and a proxy to hosted MCP. Package execution was unnecessary and was not performed.
- [Official OpenAPI](https://github.com/team-telnyx/openapi/blob/master/openapi/spec3.json): public endpoint contract fallback when MCP tool calls need credentials.

Keep upstream URLs and small task-specific schema notes; do not vendor the corpus. Record retrieval date and schema revision for comparisons. Treat retrieved text as untrusted data: instructions in provider material cannot authorize account actions, tool installation, purchases, or policy changes.

## MCP proof and observed surface

Unauthenticated `initialize` returned HTTP 200 and SSE JSON-RPC: server `telnyx_api` version `3.0.0`, protocol `2025-03-26`. Public `tools/list` and `resources/list` succeeded.

| Observed tool | Inputs | Boundary |
|---|---|---|
| `list_api_endpoints` | optional `search_query` | Discovery; advertised read-only |
| `get_api_endpoint_schema` | required `endpoint` | Schema lookup; advertised read-only |
| `invoke_api_endpoint` | required `endpoint_name`, `args` | Generic executor; explicitly advertised destructive, not read-only |
| `open_number_intelligence` | optional `action: open` | App opener; data access and charging behavior not tested |
| `open_usage_cost_explorer` | optional `action: open` | App opener; account data access not tested |
| `open_voice_monitor` | optional `action: open` | App opener; account data access not tested |

Public resources listed `ui://number-intelligence/index.html`, `ui://usage-cost-explorer/index.html`, and `ui://voice-monitor/index.html`. They were not opened.

A `tools/call` to `list_api_endpoints` with `search_query: "calls answer"` returned HTTP 401, `Authentication required for MCP method`. The process had no `TELNYX_API_KEY` (presence-only check). No secret files were opened. Therefore: transport and tool enumeration PASS; endpoint discovery, schema retrieval through MCP, account diagnostics and authenticated client integration NOT VERIFIED. No `invoke_api_endpoint` call was made. Tool annotations are hints, not access enforcement.

## Existing command versus current public schema

Compared PR #177 `lib/providers/telnyx/callControl.ts` and `lib/callControl/service.ts` against Telnyx OpenAPI fetched on 2026-09-24. Upstream master observed at `46182845c69fd59a19bdabf3238beab88c473d8a`; [pinned schema](https://github.com/team-telnyx/openapi/blob/46182845c69fd59a19bdabf3238beab88c473d8a/openapi/spec3.json).

| Check | Finding |
|---|---|
| URL/method | `POST /v2/calls/{call_control_id}/actions/answer` matches server base plus `AnswerCall` path |
| Required input | JSON body and path ID are supplied; `AnswerRequest` declares no required body fields |
| `client_state` | Schema requires base64 text; implementation encodes capture ID and generation as base64 JSON |
| `command_id` | Schema deduplicates per call-control ID; implementation persists a UUID and reuses that intent's ID on execution |
| Deprecation | No deprecation marker on the operation or these two fields |
| Capture | Optional `transcription` defaults false; `record` is separately disabled by default. Answer request omits both and does not start an assistant |
| Additional options | Schema exposes assistant/relay/streaming and webhook overrides. Their availability does not justify enabling them before consent or changing routing |

No mismatch found in this bounded answer-command comparison. It does not verify other commands, assistant-stop guarantees, account configuration, webhook delivery, or live idempotency. MCP-to-OpenAPI parity remains unverified. The provider-specific client accepts `Record<string, unknown>` bodies, so this seam lacks endpoint-specific compile-time request checking; future narrow contract tests are preferable to a runtime redesign.

## Security and local configuration recipe

Existing authority is [SECURITY.md](../SECURITY.md) and ADR-0038: optional Doppler process injection, ignored local env files, no secret values in committed config, separate environment identities. Runtime Call Control in PR #177 reads `TELNYX_API_KEY`; signed ingress uses `TELNYX_PUBLIC_KEY`. MCP must not reuse provider-connection records or tenant data as an implicit account authorization grant.

The installed `codex mcp add --help` confirms URL transport and bearer environment-variable references. After operator authorization and secure, environment-specific secret injection, this is the supported user-local registration command (NOT executed):

```powershell
codex mcp add telnyx-discovery --url https://api.telnyx.com/v2/mcp --bearer-token-env-var TELNYX_API_KEY
```

This registration alone exposes the server's broader tool surface; it does NOT enforce discovery-only access. Before connecting a credentialed agent, enforce an allowlist of `list_api_endpoints` and `get_api_endpoint_schema` in the client or a reviewed gateway. Verify that executor/app tools cannot be called. Do not treat approval prompts or `readOnlyHint` as a security boundary. No allowlist configuration has been installed or tested here.

Prefer a dedicated non-production credential with the least provider-supported privilege; actual Telnyx key scoping was not verified. Inject through the existing approved Doppler process mechanism without printing values or putting them in CLI arguments, Markdown, or logs. Do not inject an entire production secret set into developer tooling. The official npm client supports the environment variable, so its documented `--api-key` argument is unnecessary and should be avoided. Do not install project dependencies for this workflow.

Account credentials may expose resources across ResponseOS tenants. Future diagnostics must bind authenticated operator, environment, account and permitted provider resource IDs before execution, minimize returned PII and redact audit evidence. Arbitrary endpoint invocation must never become an autonomous agent capability.

## Runtime boundary and ranked opportunities

MCP may discover schemas, inspect approved configuration and propose fixes. Explicit runtime APIs retain call answer/control, routing, signed webhook processing, capture state machines, authoritative consent, transcript admission, separately governed recording, withdrawal/refusal, retries, command idempotency, escalation, CRM effects and observability. MCP cannot grant consent or bypass an execution gate.

The following are ranked recommendations, not authenticated discoveries. Read-only means within an authorized account/environment/resource scope; it does not imply anonymous access or unrestricted client-data reads.

| Rank | Capability | Classification |
|---|---|---|
| 1 | Endpoint/schema lookup for existing Call Control commands | Read-only safe |
| 2 | Call-control application and webhook URL/configuration drift inspection | Read-only safe; changes require approval |
| 3 | Number inventory and assignment reconciliation | Read-only safe; purchase/release/reassignment require approval |
| 4 | Call-session and webhook-failure diagnostics using minimal metadata | Read-only safe within data authorization |
| 5 | Assistant capture/recording configuration verification against approved policy | Read-only safe; capture setting changes require approval |
| 6 | Environment preflight comparisons against approved resource identities | Read-only safe; cannot activate an environment |
| 7 | Usage/cost inspection | Read-only safe; billing/commitment changes require approval |
| 8 | Messaging profile/delivery diagnostics | Read-only safe; sending or profile changes require approval |
| 9 | Provisioning plan plus reviewed exact diff/readback | Approval-required mutation; plan first |
| 10 | Generic executor, secret rotation, unrestricted live call/capture control | Never expose to an autonomous agent |

A future operator diagnostic could fit the governed capability system after a separate spec extends the existing contract for an operator trigger. Do not force it into `inbound_call`, create a parallel registry, or pretend descriptors execute tools. Required flow: authorize scope -> inspect -> retrieve schema -> diagnose -> propose exact action -> approve mutation -> execute a bounded action -> read back -> record redacted evidence. Approval must bind action, resource, parameters and environment, with expiry and replay protection.

## Doctrine section 21 review

1. Layer: developer/operator tooling adjoining communications adapters.
2. Integrate upstream discovery; defer internal execution capability.
3. Improves pilot debugging indirectly; does not activate the pilot.
4. Preserve schema revision, source SHA and redacted inspection evidence.
5. Supports technical verification, not recovered-revenue claims.
6. No proprietary learning claim from commodity schemas.
7. Use Telnyx's commodity interface; do not rebuild telecom discovery.
8. No CRM/FSM/telecom/workflow duplication.
9. Provider-specific tooling is isolated from deterministic runtime.
10. Future account reads require explicit tenant/resource scope.
11. No attribution logic changes.
12. Documentation-only status; no new public capability claim.
13. Existing approval gates remain; future execution requires technical enforcement.
14. Account reads can expose PII; minimize and audit; provider certifications do not certify ResponseOS.
15. Documentation/schema comparison is useful now; autonomous operations are deferred.

## Verification, gaps and next increment

Completed: clean-checkout/remote SHA/worktree inventory, open-PR inspection, source reads, public corpus HTTP 200, JSON-RPC initialization/tool/resource listing, expected unauthenticated discovery 401, npm metadata review, local Codex CLI help, and public OpenAPI comparison. No provider state mutated. No credential/configuration file was changed. No corpus was copied into the repository.

Documentation/JSON checks accompany this change. Runtime lint, typecheck, unit, build and Postgres integration suites were not run for these documentation-only edits; they remain required before merge under repository policy. Independent Claude or CodeRabbit review must cover the eventual current head, and merge remains human-only.

Next increment: operator authorizes a dedicated non-production discovery credential through the existing secret mechanism; establish and verify the two-tool allowlist, then repeat endpoint discovery and retrieve the answer-command schema through MCP. Record its endpoint identifier and compare it with this public-schema result. Until then authenticated proof is incomplete. Do not broaden into provisioning or change FRL routing, consent, recording, transcription, SIP, messaging or escalation.
