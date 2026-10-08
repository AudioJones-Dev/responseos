# Trust review follow-up

Status: author review in progress; hosted dispatch remains HOLD. This supplements, rather than replaces, closure-infrastructure-review.md.

## Immutable reference change

On 2026-10-08, git ls-remote against the official actions repositories resolved checkout v6 to d23441a48e516b6c34aea4fa41551a30e30af803, setup-node v6 to 249970729cb0ef3589644e2896645e5dc5ba9c38, upload-artifact v4 to ea165f8d65b6e75b540449e92b4886f43607fa02, and download-artifact v4 to d3f86a106a0bac45b974a628896c90dbdf5c8093. The proposal now uses these full commit references.

The Docker Registry v2 manifest response for library/postgres:16 returned OCI index digest sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d. Reading that immutable index identified Linux amd64 manifest sha256:75adc2a65806c96bc0e59030230bfe3f1c1b0d6d8f8181a8913e2b8b53bdc166. The proposed service pins the index digest. This is registry metadata verification, not a executed database acceptance result.

Hosted runner labels remain mutable; Node/npm version pins alone do not authenticate every downloaded installer or establish a network sandbox. Action/image pins reduce reference drift but do not replace independent source and runner review. Changing workflow bytes changes tooling identity; historical acceptance reports cannot be relabelled to match.

## Installation review inventory

The PR #195 exact lock includes install hooks in the root, @prisma/client 6.19.3, @prisma/engines 6.19.3, esbuild 0.28.1, prisma 6.19.3, unrs-resolver 1.12.2 and optional fsevents 2.3.3. fsevents was not installed on the inspected Windows host; Linux platform behavior still needs verification. npm ci reported five dependency scripts not yet covered by allowScripts. No new script allowlist was silently introduced.

The root postinstall checks minimatch version 10.2.5 and an exact marker, then changes its CommonJS entry under node_modules. It exits on absent minimatch and rejects unexpected version/source markers. This narrow source review does not certify the dependency hooks. Prisma hooks may involve generated clients or engine downloads; esbuild and resolver installation code require exact-source review, including transitive helper imports and fallback downloads. Review the npm bootstrap installation separately: its version is pinned, but it is outside the application lockfile.

Root installation currently executes on the networked hosted runner before application child environment sanitation. Read-only repository permissions and checkout credential removal do not prove installer isolation from runner files or action runtime credentials. Approval remains blocked until the independent reviewer accepts an explicit installation design and source/integrity review. Sanitizing later build/probe environments does not retroactively constrain installers.

## Remaining evidence obligations

| Obligation | Decision |
| --- | --- |
| Exact-lock integration provenance | Still OPEN: capture and validate source/lock hashes, tool identity, command exits and raw logs; job status alone remains insufficient |
| Evidence retention | 14-day hosted proposal unchanged, pending review; no dependency/build trees committed |
| Unused reachability runner | Still OPEN for scope reduction; preserve frozen matcher corpus and evidence references |
| 108 unresolved imports | Unchanged UNKNOWN; the Sharp fix does not justify closing unrelated aliases/computed/fallback imports |
| Independent review | Requested reviewer identity; author controls are not independent approval |
| Linux/Postgres | Not executed; no hosted dispatch |
| Braces audit / compatibility | Five high findings and 36 defects remain blocked |

## Separate Sharp candidate

Draft PR #198 adds only a native tracing configuration plus documentation/evidence/dashboard records. Fresh Windows master and PR #195 exact-lock local overlay builds include matching Sharp native binaries, execute the PNG operation and pass nine HTTP probes. Lint/types/unit checks pass (660 master, 668 PR #195). PR #195's source/lockfile remain unchanged remotely. Audit still fails, and Linux/Postgres/independent acceptance is pending. The original native failure evidence remains immutable.

The 29 synthetic infrastructure controls pass again after pinning the references; synthetic success tests gate logic only. Tool lint passes. No merge, deployment, worker activation, provider write, hosted workflow or advisory exception occurred.
