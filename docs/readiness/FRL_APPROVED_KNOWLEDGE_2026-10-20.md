# Approved-only demo knowledge — local EXPERIMENTAL successor

Preserve app35920b56e20f793edcbd4bc64bc307d05942e333 and disabled control653265f64411d4942e8712fc35ee6cf892442ce4. This change is local, synthetic and unapproved for live use. No FRL business facts or owner-approved payload are shipped.

## Runtime contract

The trusted qualification policy may bind `knowledge: { version, sha256 }`. Both fields are mandatory for an FRL knowledge demo. The generic baseline mode remains available only when neither knowledge environment setting nor a policy knowledge binding exists; it cannot claim to be an FRL demo. A policy binding with missing configuration, or configured knowledge without a policy binding, fails closed.

`RESPONSEOS_DEMO_KNOWLEDGE_FILE` names a runtime file and `RESPONSEOS_DEMO_KNOWLEDGE_SHA256` pins its exact UTF-8 bytes. Its strict schema contains schemaVersion1, statusapproved, version, approvalId, accountId, notBefore/expiresAt and exactly seven uniquely identified fact statements. Maximum approval duration is one hour. The stored account must match; links, extra fields, malformed, oversized, expired or altered packets are rejected. The status field is not itself human approval: the operator must approve the exact seven statements and digest before provisioning this trusted file.

The qualification policy binds the packet version/hash and the release pair; its config hash additionally binds the packet digest. Admission, reservation, transport and active-call heartbeats retain their existing fresh policy checks. Knowledge removal/change/expiry closes active-call authority. Retained exact-call hangup still works without the packet, policy activation or watchdog readiness.

The bridge composes fixed action restrictions and unknown-answer behavior with only the approved statements. It sends no private source URLs, customer records or caller-supplied knowledge. No tools, CRM, email, recording, booking, dispatch or transfer are added. A prompt cannot guarantee every model utterance; refusal, unsupported questions and prompt-injection attempts require actual controlled-call evaluation.

Before audio admission, the actual `session.updated` acknowledgement must echo the exact instruction string. The transaction re-reads the trusted packet and preserves all worker/tenant/capture/generation/consent/withdrawal checks. It writes `grok_demo_knowledge_acknowledged` to existing AuditLog with exact call/capture/generation, provider session ID, packet version/hash, approval reference and instruction hash. No transcript or fact content is logged. A post-binding heartbeat remains mandatory. A late withdrawal may therefore leave an acknowledgement receipt while correctly preventing audio; the receipt proves configuration acknowledgement, not consent or disconnection.

Hosted commissioning must inspect this receipt for the exact test call and compare the trusted payload/version/hash and emitted instructions with the provider acknowledgement. Local synthetic acknowledgements are not hosted proof. If the actual API does not echo exact instructions, fail closed and reassess; do not weaken the acknowledgement check. Primary contract: [xAI voice reference](https://docs.x.ai/developers/rest-api-reference/inference/voice).

## Approval and budget boundary

Target $10; absolute ceiling $20 total new incremental charges including fees, taxes and usage. No four-resource Render stack and no new recurring subscription without exact approval. Existing credits are not replenishment permission. Costs and provider access are unresolved, not assumed zero.

Release acceptance must name the tested successor pair, package, approved packet digest, caller-impact limits and no automatic reconnection. Separate decisions are needed for exact hosting destinations/costs, credential destinations and minimum permissions, dedicated-number routing, and a bounded supervised activation window. An alert or estimate is not a provider-enforced cap. Do not activate where delayed metering or unbounded charges make the ceiling unprovable.

The requirement is a real inbound call with Grok Voice, controlled safety cases, then two consecutive rehearsals. A local walkthrough is not completion. The expired original deadline is not a current estimate.

## Doctrine §21

1. Layer: governed business knowledge at the voice adapter boundary.
2. Build the small deterministic loader; use the existing voice provider.
3. Required to test approved FRL facts in the supervised pilot.
4. Preserve exact-call configuration acknowledgement evidence.
5. No claim of business outcome or successful disconnection follows from acknowledgement.
6. No learning or customer-data collection is added.
7. No replacement voice model, knowledge platform or database is built.
8. No CRM, FSM, carrier or booking functionality is duplicated.
9. Existing xAI adapter dependence is unchanged.
10. Stored tenant and retained qualification bind every read.
11. Version/hash and exact provider session reduce attribution ambiguity.
12. No live capability, factual approval or readiness claim is made.
13. Exact factual approval and release/activation decisions remain explicit.
14. No private source material or transcript persistence is introduced.
15. This narrow path is required for the requested demo; general RAG is deferred.
