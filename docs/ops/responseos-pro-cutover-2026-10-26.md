# responseos.pro cutover — 2026-10-26

Status: domain cutover and public marketing deployment verified. This is the ADR-0053 public-only deployment, not v0.3 activation or an unqualified product launch.

## Release identity

- Vercel team: `audiojones` / `team_BHxIkAGPW6qEKKQBAt9c0NGz`.
- Project: `responseos` / `prj_yfk70Hr49dG7IwIPg4EiymB6elEk`.
- Production deployment: `dpl_5LVL1RxDbaY6na5jtAAFZVgsmSK1`, READY.
- Source and public `/api/health` build SHA: `a224aff52484258627256d77c205b171f0d2c3e6`.
- Merge order: #227 (`b9d667780045ecefc6f301716274ad8b31ffa82d`), #225 (`2efe290318bda10bf992acea1d063124fe41aea5`), DNS/HTTPS verification, then #226 (`a224aff52484258627256d77c205b171f0d2c3e6`).
- #218 was left open. No recurring checks were resumed.

## DNS and routing

Authenticated Cloudflare inspection showed zero DNS records before the change. Added only:

| Type | Name | Content | Proxy | TTL |
| --- | --- | --- | --- | --- |
| A | @ | 216.150.1.1 | DNS only | 300 |
| A | @ | 216.150.16.1 | DNS only | 300 |
| CNAME | www | 19fe9b957f67906c.vercel-dns-016.com | DNS only | 300 |

Both authoritative nameservers (`desiree.ns.cloudflare.com`, `kolton.ns.cloudflare.com`) and recursive resolvers 1.1.1.1/8.8.8.8 returned the intended records. Vercel reports both names correctly configured. Certificate `cert_OaozRReeh5n0sPFlKwBXL6BU` covers apex and www with automatic renewal.

`NEXT_PUBLIC_APP_URL` is `https://responseos.pro` in production. Vercel redirects both `www.responseos.pro` and `responseos.ajdigital.app` to the apex with HTTP 308. Root, `/audit?cutover=verify`, and `/demo/receptionist?q=What%20is%20ARO` preserve paths and queries.

## Validation and boundaries

- Final #226 head `fe023a2a1086034595e3fd87a21d908594fd57de`: local lint, typecheck, 750 unit tests and build passed. CI validate and PostgreSQL 16/17/18 integration jobs passed. Local integration was not rerun for this cutover.
- Apex, audit, pricing, trust, receptionist, robots, sitemap and llms.txt return HTTP 200 with valid HTTPS.
- Assessment copy on `/`, `/audit`, `/pricing` shows $1,500 and not $1,000. Canonicals, robots, sitemap and llms.txt use the new host without localhost or the old host.
- `/admin`, `/client/dashboard`, `/api/admin/crm-sync-operations`, `/api/audit-requests` deny anonymous access with HTTP 307 to `/`.
- Existing auth-required configuration and database credentials were preserved. No live-provider credentials or activation flags were present in production metadata. No migrations, seeds, database policy writes, or provider activation were performed.
- Automatic Git deployments remain disabled in both Vercel and `vercel.json`.
- GitHub Pages dashboard publication is separately enabled; merging these PRs can publish the dashboard, not the Vercel application.

## Existing limitations

The receptionist page returns a fail-closed message: no enabled profile is available or its disclosure policy could not be read. An authenticated fetch of the previous immutable deployment `dpl_CLbZ6u4cJde7fKZAMJrkH2euBcc3` showed the identical condition. It is not a cutover regression. The page is reachable but does not answer questions; no policy was changed to enable it.

The superseded Recovery Core/Pro/Performance pricing cards remain a separate commercial-copy decision. This cutover does not establish a working lead-capture flow, live receptionist, or production-proven recovery capability.

## Rollback

1. Restore the old hostname's project-domain routing: clear its redirect and redirect status.
2. Restore production `NEXT_PUBLIC_APP_URL` to `https://responseos.ajdigital.app` for future builds.
3. Roll back Vercel production to `dpl_CLbZ6u4cJde7fKZAMJrkH2euBcc3`, source `39abc254b9a1a8cf3b055ad1898120cfed4ae952`, and verify the old hostname's routing and auth boundary.
4. Remove only the three DNS records added above to restore the previous empty zone. Preserve nameservers and any records added separately after cutover.
5. Recheck TLS, redirects and protected routes. DNS caches and cached permanent redirects may delay client recovery. Leave merged PRs and #218 unchanged unless separately authorized.

Rollback was prepared, not executed. Non-secret before/after snapshots and DNS screenshot were retained in the operator's local cutover evidence folder.
