# Production database target: evidence and the token-gated check

Status: **historical.** The check below was deployed to production in `dpl_12D5iWkrbt41f7Py53DQee3L4iJp` (commit `523e179`, created 2026-10-29 02:04:46 UTC). Vercel request logs show one authorized readout (`200` on `responseos.pro`) at 2026-10-29 02:43:09 UTC, which sets the removal deadline at 2026-11-05 02:43 UTC (2026-11-04 22:43 EDT). The route is removed in the `chore/remove-database-target-diagnostic` change. Removing the code does not revoke the running deployment: the digest variable and the deployments that carry the route need separate, operator-approved containment (§5). The October 28 text below is the original record.

## 1. Evidence gathered 2026-10-28 (read-only)

Production deployment `dpl_21w6Rad1eWQnF3nCWWdPPNpEv8WY` (source `46eb2150db677a66d49a6ab09e01534efa210278`, created 2026-10-26 23:46 UTC) was still the newest production deployment of project `prj_yfk70Hr49dG7IwIPg4EiymB6elEk` when this was written. Source: Vercel list deployments, team `audiojones`, target production.

### Manual entry of the database variables

| Finding | Source |
| --- | --- |
| Project `responseos` created 2026-07-04 17:53:53 UTC via Vercel CLI | Vercel team audit log, event `project-created` |
| Production `DATABASE_URL` added 17:56:25 and again 18:27:36 UTC; production `DIRECT_URL` added 17:56:29 and 18:27:41 UTC; all via `vercel env add` (CLI), `configurationId: null` | audit log, `env-variable-add` events, 2026-07-04 |
| Current production `DATABASE_URL` (`8qUHXFSC57EIhT9m`) created 17:56:25, updated 18:27:36 UTC; `DIRECT_URL` (`LBZSWfTbiuwvhkZU`) created 17:56:29, updated 18:27:41 UTC; both `sensitive`, `configurationId: null`, creator/editor `ajdigital` | Vercel project env metadata (no values requested or returned) |
| Preview `DATABASE_URL` / `DIRECT_URL` created 2026-07-04 20:05 UTC by the same user, `configurationId: null` | project env metadata |
| Doppler integration `icfg_wo02dxzf7g21FV33ojhsa0jW` installed 2026-06-03 (all projects, env-var write scope), but no responseos variable names it as its source | integration list; env metadata `configurationId` |
| Neon integration `icfg_qsTEdCxEXfwrli9txd4WoCXm` installed 2026-07-04 17:32:49 UTC. It wrote `DATABASE_URL_UNPOOLED` to project `audiojones-com`, not `responseos` (which did not exist yet). | audit log, `integration-installation-completed` and `env-variable-add` events |

The value's origin (Neon console, Doppler, a local file) is not recorded anywhere this investigation could read.

### Runtime observation

`/demo/receptionist` on `responseos.pro`, served by `dpl_21w6Rad1eWQnF3nCWWdPPNpEv8WY`, logged `agent profile read failed (P2021)` at 2026-10-26 23:47:34 and 23:48:09 UTC. Source: Vercel runtime logs for that deployment; the log line comes from #229. P2021 means Prisma reached a database where the `AgentProfile` table does not exist. The connection and login succeeded.

### What this does and does not establish

- **No candidate is excluded.** The 2026-10-09 catalog reads (`readback-2026-10-09.json`) list `AgentProfile` in `patient-snow` (staging) and `dark-lake` (FRL live-demo), and no public tables in `quiet-band` / `br-floral-sunset-aqn7cfw4`. Those reads are 17 days older than the deployment and do not come from it. The URL could also name another database or schema on the same host. Staging and FRL therefore stay unexcluded.
- **Unchanged variable timestamps are supporting evidence only.** The variable records predate the deployment, which fits the deployment carrying the Jul 4 value. They do not rule out a value supplied at deploy time (for example `vercel deploy --env`/`--build-env`) or any other override not visible in project settings.
- No hostname appears in build logs, runtime logs, env metadata or the audit log.

## 2. The check

`GET /api/health/database-target` (`app/api/health/database-target/route.ts`, logic in `lib/diagnostics/database-target.ts`).

- **Off by default.** It returns `404 {"error":"not_found"}` unless `RESPONSEOS_DB_TARGET_CHECK_TOKEN_SHA256` holds a lowercase 64-character SHA-256 hex digest. A missing token, the wrong token, the wrong scheme, or presenting the digest itself gets the same 404 with the same headers. Without the token you cannot tell whether the check is on.
- **Authenticated** by `Authorization: Bearer <token>`, compared as SHA-256 digests with `timingSafeEqual`. The environment stores only the digest, so the stored value is not a usable credential. Never put the token in a query string, because URLs get logged.
- **Returns only** `deployment_id` (`VERCEL_DEPLOYMENT_ID`), `deployment_url` (`VERCEL_URL`), `environment`, `build_sha` (inlined at build), `runtime_git_sha`, and `database_url: {status, hostname, database}`. `status` is one of `ok | missing | unparseable | unsupported_scheme`; it never carries parser text.
- **Never** connects to or queries the database, imports Prisma, logs anything, or returns the username, password, port or query parameters. `DIRECT_URL` is not read.
- **Not cacheable:** `force-dynamic`, `Cache-Control: no-store, no-cache, must-revalidate, private, max-age=0`, `Pragma: no-cache`, `Expires: 0`, `X-Robots-Tag: noindex, nofollow`.
- **Proxy:** the exact path is added to the public list, the same way webhooks self-authenticate. Without that, the auth-required proxy redirects it to `/`. Sub-paths stay protected.

Tests: `tests/unit/database-target-diagnostic.test.ts` covers the rejection cases, disabled versus unauthorized being identical, the exact authorized shape, redaction of synthetic credential fragments, fixed error statuses, no console output, and no database or Prisma imports. `tests/unit/route-protection.test.ts` covers the exact-path public rule.

### Accepted URL format

The parser is deliberately stricter than WHATWG `URL` and works on the raw string. WHATWG parsing resolves dot segments and lets an unencoded `/`, `?` or `#` in a password move the host boundary; an independent review showed both leaking credential fragments. Independent reviews of the strict parser at `3af6909`, `ac5b08c` and `d3ac6bf` each found no leak. Each ran several million random inputs and about 68 million exhaustive short inputs, with an exact userinfo-marker oracle and a non-interference check. The `d3ac6bf` review also compared 1,100 accepted URLs against what Prisma 6.19.3 actually sends to Postgres, with 0 mismatches.

- **`missing`:** unset or the empty string.
- **`unsupported_scheme`:** a value of the form `scheme://…` whose scheme is not `postgres`/`postgresql` in any case, e.g. `mysql://`. A value with no `://` is `unparseable`.
- **`ok`:** exactly `postgres://` or `postgresql://` (lowercase, as Prisma requires), then `USERINFO@HOST[:PORT][/DATABASE][?…][#…]`. All of these must hold:
  - **Characters:** printable non-space ASCII only (`0x21`–`0x7E`). Trailing spaces, tabs, CR and LF are removed first, as Prisma does. Leading whitespace is rejected, as Prisma rejects it.
  - **The `@`:** exactly one `@` in the whole value. It comes before the first `/`, `?` or `#` after `//`.
  - **`USERINFO`:** non-empty and does not start with `:`. It is never decoded or returned.
  - **`HOST`:**
    - Either two or more dot-separated labels of letters, digits and `-`, returned as written.
    - Or a bracketed address that Node's `isIPv6` accepts, returned in normalised form (`[::0001]` becomes `[::1]`).
  - **`PORT`:** 1–5 digits, value 0–65535. It is not returned.
  - **`DATABASE`:** one non-empty path segment, returned **as written, not decoded**, because Prisma sends it to Postgres raw. It must not contain `%`, `"`, `<`, `>`, `` ` ``, `{` or `}`, and must not be `.` or `..`. With no path at all, `database` is `null`, and Prisma connects to `postgres`.
  - **Query and fragment:** ignored and not returned.
- **`unparseable`:** everything else. That includes:
  - An uppercase or mixed-case `postgres` scheme.
  - Leading whitespace, a BOM, whitespace or a control character inside the value, or any non-ASCII character.
  - No `@`, more than one `@`, an empty username, or an `@` after the first `/`, `?` or `#`. The last case covers an unencoded `/`, `?` or `#` in the password.
  - A single-label host such as `localhost` or `db`, a percent-encoded host, a comma-separated multi-host list, or an invalid IPv6 such as `[:]` or `[1.2.3.4]`.
  - A bare `/` (Prisma would send an empty database name, so Postgres uses the user name), more than one path segment, `.` or `..`, or a database containing `%`, `"`, `<`, `>`, `` ` ``, `{` or `}`.
  - A bracketed IPv6 with a zone ID (`%eth0`).
- **Encodings:**
  - `%40`, `%2F`, `%3F` and `%23` inside the password are accepted. They stay in the userinfo and are never decoded.
  - The database is never decoded. A `%` in it is rejected, because Prisma would send the encoded text unchanged and the name would be ambiguous to read.
  - The host is never decoded.
- **Hosts are reported as written.** Non-canonical IPv4 text such as `127.1` or `0177.0.0.1` is returned unchanged, but the resolver normalises it (both connect to `127.0.0.1`). Neon hosts are names, so this does not affect the readout.
- **Strictness fails closed.** Some URLs Prisma would accept come back `unparseable`, such as single-label hosts or a missing username. The check then returns nothing, which is safe.

**Limitation:** a `?schema=` (or `?host=`) parameter can change where Prisma actually connects. A `P2021` could come from the schema rather than the database. This check does not report query parameters. Reporting them would be a scope change for the operator to decide.

## 3. Deployment and access requirements (each needs separate operator approval)

1. **Merge** this change to `master` after CI is green. Git deployments stay disabled (`vercel.json`).
2. **Generate the token locally** (32 random bytes as **hex only**: `openssl rand -hex 32`. If Clerk is ever configured, a token starting `ak_`, `mt_` or `oat_`, or shaped like a JWT, would be sent to Clerk for verification; a hex token is rejected locally first.). Keep it in the operator's password manager. Do not paste it into chat, the repo, or a ticket.
3. **Add one production variable:** `RESPONSEOS_DB_TARGET_CHECK_TOKEN_SHA256` = the SHA-256 hex of the token (`printf %s "$TOKEN" | shasum -a 256 | cut -d' ' -f1`; paste only the 64 hex characters, or the check stays off), type sensitive, target production only. Add no other variable, and do not touch `DATABASE_URL`/`DIRECT_URL`.
4. **Accept ADR-0085 first.** It is Proposed. ADR-0053 covers only the public read-only surfaces and does not authorize this route. Then **deploy production manually** the same way as the current production deployment, which Vercel built by cloning `master` from GitHub. In the Vercel dashboard (team `audiojones`, project `responseos`), create a production deployment from `master` at the merged SHA. Pass no `--env`/`--build-env` overrides and edit no other variable, so the deployment uses the saved project variables. The build runs `npm ci` and `next build` only, with no `prisma migrate`. Confirm that "Automatically expose System Environment Variables" is on; otherwise `deployment_id` and `deployment_url` read `null`.
5. **Call it once from the operator's terminal:** `curl -sS -H "Authorization: Bearer $TOKEN" https://responseos.pro/api/health/database-target`. The `*.vercel.app` URLs sit behind Vercel SSO protection; the custom domain does not.

No new database credentials, Neon changes, migrations or accounts are involved.

## 4. Reading the result

- Check that `deployment_id` matches the deployment that is current for `responseos.pro` at that moment, and that `build_sha` matches the merged source.
- Map `hostname` (`ep-<name>[-pooler].<region>.aws.neon.tech`) to a Neon endpoint ID, then to its project and branch, using the Neon console or API. `database` gives the database name.
- **What it proves:** the destination configured for the **new** deployment.
- **What it does not prove:** where `dpl_21w6Rad1eWQnF3nCWWdPPNpEv8WY` connected. If the variable records still show their Jul 4 `updatedAt` and the old deployment was made without deploy-time overrides, the result is strong supporting evidence for the old deployment too. Report it only that way, never as verified for the old deployment.

## 5. Disablement and removal

- **Instant stop:** promote or roll back to a production deployment made before the digest existed (e.g. `dpl_21w6Rad1eWQnF3nCWWdPPNpEv8WY`). The route then no longer exists.
- **Disable:** delete `RESPONSEOS_DB_TARGET_CHECK_TOKEN_SHA256` from production and redeploy. Vercel fixes environment variables per deployment when it is created, so the running deployment keeps the digest until it is replaced.
- **Within 7 days of the readout:** open a `chore:` PR that deletes the route, `lib/diagnostics/database-target.ts`, its test, and the `PUBLIC_EXACT` entry, then deploy it. Rotate nothing: the token never left the operator's machine, and the stored digest is useless on its own.
- If the token may have leaked, revoke it the same way as **Disable** or **Instant stop**: delete the production digest variable and redeploy, or promote a pre-digest deployment. Deleting the variable alone does not revoke it, because the running deployment keeps the digest. Generate a new token only if the check is still needed.
