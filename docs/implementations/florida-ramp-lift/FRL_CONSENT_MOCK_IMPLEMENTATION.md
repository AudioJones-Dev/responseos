# FRL consent-state mock: implementation review

**Status:** PARTIALLY_SHIPPED on feature branch only; unmerged, not connected to live call handling. This document is an implementation note, not a deployment approval.
**Date:** 2026-11-05
**Related architecture:** Draft PR #240 for the consent-gated call and memory proposal.

## Scope of this PR

- New pure consent contract under `lib/communications/consent/contracts.ts`.
- Founder/caller decisions must both be `accepted` before mock content ingestion.
- Decline, timeout and revoke block further content and cannot be overridden later in the same call.
- Duplicate event IDs have no additional side effects.
- Deterministic mock call facade and unit tests.
- No providers, network connections, database operations, CRM writes, recording endpoints, env vars, or secrets.

## Protected client configuration

FRL's actual main phone number is sensitive client operational configuration. **Do not commit the phone number to repository code, docs, tests, fixtures, logs, or CI output.** During subsequent approved integration, configure it in a protected environment/tenant mapping; use synthetic E.164 numbers in unit tests. The main line's mobile carrier, forwarding type, and distinct founder endpoint must still be established before routing.

## Limitations and required next steps

1. `MockConsentCall` is in-memory and does not persist consent or prove capture was stopped by a provider. It is **not** an approved legal or production recording control.
2. The current `app/api/webhooks/telnyx/calls/route.ts` and `lib/providers/telnyx/normalize.ts` are **not** consent gated by this PR. Do not enable the FRL line there. A separately approved PR must enforce capture interval and participant/leg consent *before* raw webhook persistence, transcript/summary normalization, AI extraction, or downstream CRM sync. A signed webhook alone does not establish consent.
3. For a production design, represent provider command acknowledgment and capture state separately from mere permission; delayed segments must be checked against a server-authorized time/leg window.
4. Extend state handling to late joiners, ordering/replay, disclosure version changes, verified remote party identity, and explicit legal-approved retention policy.
5. Current code has no actual DTMF, Call Control or outbound FRL dialer implementation. Native mobile dialer calls remain outside this service unless routed through a separately verified controlled path.
6. Before merge, run lint/typecheck/unit/build/integration gates in CI. No runtime tests were executed by this GitHub-only authoring operation.
