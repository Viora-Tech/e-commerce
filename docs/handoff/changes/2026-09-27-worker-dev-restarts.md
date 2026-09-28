# Worker dev restarts

**Worker dev restarts** (27 September 2026, `claude/worker-dev-watch`): `apps/worker` `dev` now
runs `scripts/dev.ts`, a small supervisor that watches the worker's transitive workspace
packages (`src/` + `package.json` of each) and restarts it on change. It replaces
`bun --watch`, which on Windows ignored `packages/*`. See developer docs, Running locally,
"Worker restarts in dev". No migration.
