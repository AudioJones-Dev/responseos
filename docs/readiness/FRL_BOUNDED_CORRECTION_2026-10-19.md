# Bounded receipt correction — partial local candidate

Status: EXPERIMENTAL, incomplete commissioning correction. Application parent afa127e6efc9c56065d4d52abf6ed1ae9b5fcdef and disabled-control parent 83f5a6c4c1dda2360e2998c59a39df17ccc7ae73 remain frozen. Original commissioning baselines 952280b904cbe3988121d26727097fdf80899030 and 9b7b8c5c1a66712aa133061aa3413b0b9dd63a10 are preserved. Owner-approved bounded local scope was relayed as Sentinel_9fe1e8ab3b0c8191a466ed3e604db7c8 on October 19. This candidate completes only independently implementable receipt guards and per-case environment restoration.

## Implemented boundary

Answered, speak-ended and gather-ended handlers consult the independent receipt before advancing state or dispatching commands. History resume checks again before START_PENDING becomes AI_ACTIVE. Existing content admission checks and the capture-lock drain protocol remain authoritative.

Additive migration 0024 skips an UPDATE that changes control_state to CALL_RECEIVED, DISCLOSURE_PLAYING, AWAITING_DTMF, CONSENT_PENDING_OPERATOR, START_PENDING, AI_ACTIVE or TRANSFER_PENDING when an exact account/capture/provider-call receipt is visible. RETURN NULL skips the entire row update, including other columns in that statement; updateMany returns zero affected rows. It does not raise an error that would roll back preceding, preauthorized content in the transaction. A single-row ORM update expecting a returned row can still report no row; callers must not interpret a skipped transition as authorization. Migration 0001–0023 bytes are unchanged. The receipt lookup is intentionally not generation-scoped: withdrawal of the stored call cannot reopen consent through generation changes.

This is best-effort concurrent-snapshot defense. It adds no receipt/control fence. A receipt committed after the guard lookup can precede the actual write. A controlled SQL interleaving reproduces that residual on all three PostgreSQL versions. The trigger is not an atomic withdrawal barrier, does not cancel previously authorized work and cannot authorize a provider action. Receipt, drain, AI-stop result and authenticated call-disconnection evidence remain distinct.

Qualification integration cases now restore their entire pre-case environment in finally, including when assertions fail. Existing hoisted module reset and mocked command adapter remain. These changes are not a network sandbox; application tests must run inside an independently enforced network-isolation boundary.

## Pending decisions and work

- End call still holds the capture lock during provider I/O. Moving it outside creates a final-check/send gap for generation or qualification changes. No interpretation of a durable claim as irrevocable dispatch authority has been approved here. The refactor remains blocked pending that decision.
- Explicit withdrawal continuation is not implemented. Coordinating original withdrawal and continuation with a shared one-shot AI-stop claim needs a narrow scope decision; a drain/evidence-only alternative would not send AI stop. General command retry behavior is unchanged.
- AI-start handoff remains a separate blocker and is not redesigned. Other provider lock holders, generic event replay, background retry, migration 0025, F2 and automatic transfer remain outside this patch.
- Full final-tree application/control lint, typecheck, unit, integration, build, browser and tooling validation is NOT RUN. Compatible offline Linux Node/Prisma/Next native dependencies are unavailable; Windows host fetch mocking does not enforce isolation for native APIs or children. No downloads, installs, firewall changes or host application execution were attempted. Prior passing suites do not validate this tree.

## Executed verification

The external commissioning-bounded-correction-evidence-20261019 package runs actual migration SQL and probes in cached PostgreSQL 16/17/18 containers: network none, no published ports, nonprivileged postgres user, capabilities dropped, no-new-privileges, read-only root and disposable tmpfs. Each version passes 17 assertions: seven receipt-only state transitions, unrelated-call isolation, receipt independence during preauthorized content, content commit without reactivation, allowed drain, receipt and drain permanence, the documented concurrent gap, populated 0023→0024 upgrade, restored function/trigger/ACL equality and restored guard behavior. Containers are removed. These are SQL regressions, not the existing application integration matrix or provider/UI evidence.

Four application regression cases are authored for answered, speak, gather and history after a receipt, but remain unexecuted. Node 24.18.0 executes only the reviewed built-in filesystem/Docker orchestration harness on Windows. Test payloads and their children execute within the isolated containers. Pinned npm 11.16.0/Vercel CLI 41.7.0 configuration, install gate, stdin token transport and disabled activation remain inherited; no real-token or real-CLI compatibility validation is claimed.

## Doctrine section 21

1. Evidence and consent-state layer. 2. Build a bounded correction; defer unsafe dispatch changes. 3. Addresses a local pilot-path defect without activating the pilot. 4. Preserves immutable receipt, migration and preauthorized content evidence. 5. Makes no cessation or recovered-revenue claim. 6. No proprietary-learning expansion. 7. Reuses PostgreSQL rather than buying new infrastructure. 8. No CRM, carrier or workflow-platform duplication. 9. No new vendor dependency. 10. Receipt matches stored account, capture and provider-call identity. 11. No cross-leg or acceptance-to-disconnection inference. 12. Local experimental status only. 13. Explicit unresolved dispatch/continuation decisions remain with the owner. 14. Synthetic data only; no retention-policy expansion. 15. Required to close reproduced state-only gaps; broader work is deferred.
