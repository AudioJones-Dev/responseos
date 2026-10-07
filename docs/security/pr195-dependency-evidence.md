# PR 195 dependency evidence and remediation

October 7, 2026. PR remains draft and unmerged. This security follow-up is
explicitly authorized; it adds no worker, provider execution or gate bypass.

## CI and inheritance proof

Original PR head: `c42c848397f9ccc6973eb12cbc451ad0b63e01e3`.
Fetched master: `3252a6de9c8a40992b3edc655c05ffbe73459194`.
[CI run 37690513641](https://github.com/AudioJones-Dev/responseos/actions/runs/37690513641)
completed with failure. Both validate and integration passed npm ci, failed
`npm audit --audit-level=high`, then skipped their tests/builds. Local test results
were not CI acceptance.

Before remediation, both package files were byte-identical between these commits:

- package.json SHA-256: `8e7d15a1c70f3b1f224136738f0b26a970d5b6bff5e7a7a15b5c917f2caca451`
- package-lock.json SHA-256: `480c7faddd49a6c755361484191896b094a03c38264adad023cf08ed817b128e`

Fresh npm 11.16.0 audits of the PR and a clean directory containing master's
git-exported manifests returned identical vulnerability objects: 11 affected
packages, 2 moderate / 8 high / 1 critical. The 11 are **package-level findings,
not 11 distinct advisories**. Eight advisory IDs produce these findings, including
transitive severity propagation. Every row below is inherited, verified by exact
manifest identity and per-finding comparison, rather than inferred from age.

[Machine-readable original ledger](./pr195-inherited-audit.json) retains advisory
IDs, titles, ranges, affected nodes, versions and resolved dependency paths.
[Post-remediation audit](./pr195-remediation-audit.json) records the remaining chain.

## All 11 package findings

`root` means ResponseOS. B1 is the unpatched braces advisory; A1–A7 identify the
other advisories listed below. Paths are representative resolved paths, not a
claim that each package has only one consumer.

| Package | Original version / severity | Advisory or propagated cause | Dependency path | Remediation / disposition |
| --- | --- | --- | --- | --- |
| next | 16.3.4 / critical | A1 plus sharp/A2 | root → next | 16.3.6, minimum patched release on the existing minor line |
| sharp | 0.35.4 / high | A2 | root → next → sharp; also direct tooling dependency | 0.35.5 in direct declaration and existing override; platform packages/libvips follow |
| source-map-js | 1.2.1 / high | A3 | root → next → postcss 8.5.23 → source-map-js; also Tailwind/magicast | Lock-only 1.2.2 within declared ranges |
| brace-expansion | 5.0.9 / high | A4, A5, A6 | root → eslint 9.39.5 → minimatch 10.2.5 → brace-expansion | Lock-only 5.0.12 fixes all three |
| fast-uri | 3.1.7 / moderate | A7 | root → ajv 8.20.0 → fast-uri | Existing override patched to 3.1.8 |
| ajv | 8.20.0 / moderate | Propagated A7; no distinct advisory here | root → ajv → fast-uri | ajv unchanged; patched fast-uri clears finding |
| braces | 3.0.3 / high | B1 | root → eslint-config-next 16.3.4 → @next/eslint-plugin-next 16.3.4 → fast-glob 3.3.1 → micromatch 4.0.8 → braces | BLOCKED: no published patched version |
| micromatch | 4.0.8 / high | Propagated B1 | Same chain through micromatch → braces | BLOCKED on B1 |
| fast-glob | 3.3.1 / high | Propagated B1 | Same chain through fast-glob → micromatch → braces | BLOCKED on B1 |
| @next/eslint-plugin-next | 16.3.4 / high | Propagated B1 | root → eslint-config-next → plugin → fast-glob → micromatch → braces | BLOCKED on B1; plugin patch/latest retain affected chain |
| eslint-config-next | 16.3.4 / high | Propagated B1 | root → config → plugin → fast-glob → micromatch → braces | BLOCKED on B1; not downgraded to unrelated Next 14 tooling |

## Advisory evidence and exploitability assessment

These are repository reachability assessments, not exploit demonstrations or
proof that every deployment is safe. Severity is retained from the advisories;
limited observed reachability is not used to waive the security gate.

- **A1 [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j):**
  critical, Next >=16.2.0 <16.3.6. Node ImageResponse with attacker-controlled SVG
  content can execute code. No `next/og` or `ImageResponse` usage was found in
  app/lib/scripts. The trigger is not demonstrated here; patched regardless.
  [Official 16.3.6 release](https://github.com/vercel/next.js/releases/tag/v16.3.6)
  identifies this security fix.
- **A2 [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w),
  CVE-2026-96889:** high, sharp <0.35.5. Vulnerable librsvg can permit code execution
  under certain glibc Linux runtime conditions. The direct SVG call in
  `scripts/generate-og.mjs` uses a repository-owned asset. No untrusted upload
  decoder was found, but sharp also belongs to Next's runtime tree; deployment
  conditions were not independently established. Patch includes updated binaries.
- **A3 [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q),
  CVE-2026-93749:** high, source-map-js >=1.0.0 <1.2.2. Malicious indexed map
  offsets can stall the event loop. Repository usage is through build tooling;
  no request-time map-consumer API was found. Malicious input maps remain the
  relevant trigger. Resolved with the compatible patch.
- **A4 [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr),
  CVE-2026-102277:** moderate quadratic brace expansion; installed 5.0.9 is in
  affected >=4.0.0 <5.0.12. Fixed at 5.0.12.
- **A5 [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7),
  CVE-2026-102278:** high nested-brace recursion exhaustion; affected >=4.0.0
  <5.0.11 on this line. Fixed by chosen 5.0.12.
- **A6 [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p),
  CVE-2026-102276:** high comma-part recursion exhaustion; affected >=4.0.0
  <5.0.10 on this line. Fixed by chosen 5.0.12. A4–A6 are development-only
  minimatch consumers in this lockfile; attack requires crafted glob input.
  No application request path into these APIs was found.
- **A7 [GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj),
  CVE-2026-86472:** moderate host normalization inconsistency; installed line
  affected >=3.0.0 <3.1.8. Host checks using these APIs can be evaded with encoded
  case variants. Observed direct Ajv usage validates repository environment
  schemas in `scripts/config/environment-contract.mjs`; no fast-uri-based
  request host allowlist was found. Patched without changing Ajv.
- **B1 [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
  CVE-2026-93687:** high, braces <=3.0.3, no patched release listed. Deeply nested
  patterns can exhaust recursive parser/compiler stacks. All five remaining
  affected packages are dev-only in this lockfile, through the Next ESLint
  plugin. An attacker-controlled pattern in tooling/configuration is the
  relevant trigger; no public request route into it was found. This narrows the
  observed exposure but does not clear the audit or authorize merge.

## Why the remaining chain is not force-fixed

Registry readback on this date: braces latest 3.0.3; micromatch latest 4.0.8 still
depends on braces ^3.0.3; fast-glob latest 3.3.3 still depends on micromatch;
@next/eslint-plugin-next 16.3.6 and latest 16.4.0 both retain fast-glob 3.3.1.
The advisory has no published patch. Updating these within available supported
versions does not remove the root cause.

The npm recommendation to move eslint-config-next to 14.2.35 is a major-line
downgrade, not a compatible security patch for the current Next 16 setup.
Aliasing unrelated glob implementations, removing lint rules, locally hiding
the advisory, or changing audit severity/omit-dev settings would not satisfy
the requested security policy. None was done. A vetted upstream fix or separately
reviewed dependency replacement is required before this chain can be cleared.

## Minimality and reassessment

Only five package versions and their required platform/runtime companions change.
React, Prisma, ESLint, eslint-config-next and its rules remain unchanged. No
application, persistence, migration or CI-policy source changes are part of this
follow-up. The current npm audit still exits nonzero at the unchanged high threshold:
**5 high, 0 critical, 0 moderate**. Therefore #195 is still not merge-eligible.
Production-only auditing, if clean, is supplementary evidence rather than a
replacement for the required full audit. PR B remains unstarted.

Full patched-dependency validation is recorded in
[the validation report](../readiness/frl-ledger-persistence-validation.md).
The PR body records follow-up CI against the pushed remediation commit.
