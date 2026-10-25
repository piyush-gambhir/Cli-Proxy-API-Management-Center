# Node tooling review

Reviewed on 2026-10-26 against origin/main 38724de in an isolated worktree. The original checkout's user-modified ledger, accounts, localization, AGENTS and tests were not copied, staged, stashed, reset or edited. This branch changes only the remote baseline's tooling, tool-version guidance and this report. Existing security overrides remain intact.

Node moves from 24.22.1 to 26.12.1, Bun from 1.3.14 to 1.4.4, preserving the Bun lockfile and single-file release contract. Updates include React/DOM 19.2.9 to 19.3.1, motion 12.42.2 to 14.6.0, Vite 8.1.6 to 8.3.5, React Vite plugin 6.0.5 to 6.1.2, ESLint 10.6.0 to 10.13.0, typescript-eslint 8.63.0 to 8.72.0, globals 16.5.0 to 17.13.0, react-refresh 0.4.26 to 0.5.7, and current compatible types, Sass and i18n packages. Registry latest versions were checked directly.

TypeScript 7.0.2 checks and builds use an explicit typescript7 CLI alias, avoiding a bare tsc binary collision. TypeScript 6.0.3 remains solely for the ESLint compiler API: typescript-eslint 8.72.0 supports TypeScript below 6.1. The outdated report lists only this documented API hold; the actual checker is version 7. No application source or API contracts were changed.

Validation used exact Node 26.12.1 and Bun 1.4.4:

- Explicit TypeScript 7 check and all 1,667 tests across 168 files pass.
- Lint passes with two existing Fast Refresh warnings in FieldPrimitives.tsx. No warning rules were changed.
- Production build and the required bun run verify pass. The production artifact remains one dist/index.html, 3,439.80 kB raw and 1,080.39 kB gzip, with scripts, styles and assets inlined.
- Frozen install, changed configuration formatting, and git diff --check pass. Full and production Bun audits both return an empty findings object.
- Disposable Chromium loads the actual production HTML. It logs in with a disposable key against a local HTTP fixture, reaches the Accounts heading, follows the System link and waits for Management Center Info. Nine requests, zero non-GET writes and zero page errors. External browser requests are blocked. No real proxy, provider, account, credentials or user browser profile was involved.

Gains are current build and checking tools and dependency maintenance while retaining upstream security pins. No before/after runtime or browser performance benchmark was conducted. The artifact size is an observation, not a claimed improvement.

Publication is deliberately not performed. CI runs on pull requests and main/dev pushes. v* tags trigger a release workflow that renames the artifact to management.html. Critically, sync-upstream.yml runs on main pushes, daily at 01:23 UTC and manual dispatch, and itself synchronizes upstream and publishes a latest release. Those triggers and scripts are preserved. No upstream synchronization, tag, workflow dispatch, push, release or deployment was run during this review.
