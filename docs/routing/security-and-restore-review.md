# Security review and restore evidence — October 9

Scope: local engineering review, not independent security certification or hosted penetration testing.

## Findings addressed

* Provider readback rejected Task priority NORMAL. User approved MEDIUM; activity field/enum validation now fails closed.
* Company verified=true from a payload is insufficient. Exact trusted tenant/environment/portal/Company binding is required before mutation, with existing Company readback and persisted approval reference. No Company creation or guessed association IDs.
* Worker inherited migration credentials. Runtime now rejects DIRECT_URL, intake keys, known HubSpot token variables, remote non-TLS URLs, disabled certificate verification, production/live mode and unbounded concurrency. Tests cover these boundaries.
* Notes/Tasks now have persisted dispatch checkpoints, independent readback, association proof and uncertainty quarantine. Lost Task acknowledgement never automatically retries; definitive 429 resumes persisted activity identities.
* Internal notices use existing Notification storage atomically with audit/ledger updates, idempotently per tenant/delivery/event. Only opaque references are stored in notice messages. They remain queued; no email/SMS/external alert delivery is claimed.

Reviewed: hosted HMAC domain/credential tenant/environment/audience binding; byte/schema bounds; server digest; replay/conflict; scoped SQL; atomic claims/fences; uncertainty/lease expiry; redacted logs/status; operator authorization/origin checks; retention holds. No raw images, LLM routing, quotes or scheduling added.

Residual gates: actual least-privilege grants/RLS and negative cross-tenant tests on the approved hosted target, certificate/network verification, approved retention, external alerts, Company IDs and real provider acceptance. Application tenant scoping does not prove database-enforced isolation. Worker needs Account row locking, scoped intake reads, delivery reads/updates, notification read/insert and audit insert; final grants need Prisma SQL readback. No DDL/delete/migration principal. Token-name denylist is defense in depth, not general secret discovery. Manifest changes intentionally quarantine incompatible pending work.

## Empirical local restore

PostgreSQL 16 source stopped cleanly; postmaster PID absence checked. Entire owned synthetic cluster copied into a new validation directory, then clone started on loopback 55441. Source and clone were never written concurrently. Method follows https://www.postgresql.org/docs/17/backup-file.html.

Observed copy: **115,669,860 bytes**; copy/start/verification **5.52 seconds** on this workstation, not hosted RTO. Digest matched all drill-tenant rows: **4 intakes, 4 deliveries, 18 audits, 7 internal notices**. Confirmed replay retained its receipt. Interrupted Task claim became uncertain; final states confirmed/rejected/uncertain/uncertain. No uncertain item reclaimed; zero provider calls during recovery. Clone shut down cleanly; source restarted for tests.

Reproducible `scripts/routing-restore-drill.ts prepare|verify` requires loopback, explicit synthetic-only flag and snapshot path. Synthetic .invalid fixture stays outside Git. No destructive cleanup. CI defines logical pg_dump/pg_restore on disposable PostgreSQL 16/17; read back CI before claiming success.

Limits: local cold restore does not prove Neon PITR, online consistency, production RPO/RTO or hosted disaster recovery. Separately approve a named synthetic hosted branch restore; verify hashes/receipts/fences/uncertain holds and measure RPO/RTO. Restore never authorizes blind external resend.

Fresh staging metadata revealed PostgreSQL 18 in us-west-2. CI now includes 18 alongside 16/17, including logical restore. The staging project currently allows public connections without an IP allowlist; an approved network/grants review must address exposure before use.
