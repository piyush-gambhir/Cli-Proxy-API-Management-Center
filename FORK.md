# This fork

`piyush-gambhir/Cli-Proxy-API-Management-Center` is upstream
[`router-for-me/Cli-Proxy-API-Management-Center`](https://github.com/router-for-me/Cli-Proxy-API-Management-Center)
`main` plus the changes listed below. The fork adds the **Ledger** dashboard at `/ledger` and runs
newer tooling. Every other file stays byte-for-byte equal to upstream.

`main` keeps upstream as an ancestor: upstream is merged in, never rebased or squashed, so the
next sync only brings new upstream commits.

## Files that differ from upstream

`scripts/fork/check-fork-diff.mjs` compares the fork with its last merged upstream commit. It fails
when a changed file is missing from this table. It also fails when a row no longer matches any
changed file, except in the sync job, where that is only a warning. It runs on every pull request
and push (`.github/workflows/fork.yml`) and before every sync release.

| Path | Kind | Why |
| --- | --- | --- |
| `FORK.md` | fork only | This document. |
| `scripts/fork/**` | fork only | The documentation check and the sync conflict resolver. |
| `.github/workflows/fork.yml` | fork only | Runs the documentation check. |
| `.github/workflows/sync-upstream.yml` | fork only | Daily upstream merge, then publishes `management.html` as a `vX.Y.Z-ledger.N` release. CLIProxyAPI's panel updater downloads it when `panel-github-repository` points at this fork. |
| `.github/workflows/security.yml` | fork only | CodeQL and the security gate. |
| `.github/dependabot.yml` | fork only | Weekly updates for GitHub Actions and Bun dependencies. |
| `.nvmrc` | fork only | Node version for local work. |
| `src/ledger/**` | fork only | The Ledger shell (with upstream pages embedded under `/ledger`), accounts screen, account health, limits model and theme. |
| `tests/accountHealth.test.ts` | fork only | Ledger tests. |
| `tests/accountReauthentication.test.ts` | fork only | Ledger tests. |
| `tests/ledger*.test.ts` | fork only | Ledger tests. |
| `tests/quotaLedger.test.ts` | fork only | Ledger tests. |
| `src/App.tsx` | modified | Mounts `/ledger/*` and wraps upstream's login page and shell (`src/ledger/LandingRoutes.tsx`), so the Ledger is the landing after login. Also wraps the classic routes in `ClassicRedirect` (`src/ledger/classicRedirect.tsx`), so links from upstream pages embedded in the Ledger to classic paths open the Ledger equivalent. Upstream's routes are otherwise unchanged. |
| `src/services/api/oauth.ts` | modified | `startAuth()` takes an optional target account and sends `target_auth_id`, so Reauthenticate refreshes an existing credential instead of adding a new one. |
| `src/features/oauth/hooks/useOAuthFlows.ts` | modified | Passes that target through. |
| `vite.config.ts` | modified | Dev server only: proxies `/v0`, `/v1` and `/v8` to a local CLIProxyAPI (`CPA_DEV_PROXY_TARGET`). No effect on the build. |
| `src/i18n/locales/*.json` | modified | One `ledger` block appended at the end of each locale. Nothing else in the files changes. |
| `package.json` | modified | Bun 1.4.4, Node 26 `engines`, the latest dependency releases, TypeScript 7 for type-checking (`typescript7` alias; TypeScript 6 stays for typescript-eslint), and security `overrides`. |
| `bun.lock` | modified | Follows `package.json`. |
| `.github/workflows/ci.yml` | modified | Node 26.13.1, Bun 1.4.4 and current action versions. |
| `.github/workflows/release.yml` | modified | Node 26.13.1, Bun 1.4.4 and current action versions. |
| `README.md` | modified | Bun version line, which upstream's `tests/toolchainVersion.test.ts` checks. |
| `README_CN.md` | modified | Bun version line, as above. |
| `AGENTS.md` | modified | Bun and Node version line, as above. |

## How a sync resolves conflicts

`.github/workflows/sync-upstream.yml` merges upstream `main` every day and on every push to `main`.
When the merge conflicts, `scripts/fork/resolve-sync-conflicts.mjs` resolves these files and
nothing else:

- **`package.json`:** Starts from upstream's file. Each dependency gets the higher of the two
  versions. The fork's `overrides`, `engines` and changed scripts are kept, and `packageManager`
  gets the higher Bun.
- **`bun.lock`:** Regenerated from the merged `package.json`.
- **Locale files:** Upstream's file, with the fork's `ledger` block appended again.
- **CI, release and the toolchain docs (`ci.yml`, `release.yml`, `README.md`, `README_CN.md`,
  `AGENTS.md`):** Upstream's file, with the higher Node, Bun and action versions applied.

Then the job runs the full verification (`bun install --frozen-lockfile`, tests, lint, build) and
the documentation check. Only if both pass does it push the merge and publish a release.

A conflict in any other file stops the job with an error. Merge it locally:

```bash
git fetch upstream && git merge upstream/main
# resolve, then: bun install && bun run verify && node scripts/fork/check-fork-diff.mjs upstream/main
```

## Removing a difference

Shrink this table when upstream catches up:

- When upstream moves to i18next 27, delete `src/ledger/i18next-types.d.ts`.
- When upstream reaches the fork's Node, Bun or dependency versions, the resolver keeps upstream's
  value and the row stops differing. The sync still releases and prints a warning, but pull requests
  and pushes fail the check until the row is removed, so the table stays accurate.
