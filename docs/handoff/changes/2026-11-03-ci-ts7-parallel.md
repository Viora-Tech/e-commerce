# CI: TypeScript 7 typecheck, parallel jobs, sharded tests, turbo cache

CI was one ~40 min job (lint, typecheck ~13–18 min, sweeps ~3 min, tests ~23 min, in a row).

- **TypeScript 7 for typecheck:** every package's `typecheck` runs `scripts/typecheck.ts`, which
  calls TypeScript 7.0.2 (installed as `typescript7`). Measured locally on all 62 packages, cold,
  one at a time: 12m24s with 5.9, 3m09s with 7, 0 errors either way. TypeScript 5.9 stays for
  Next.js, the sweeps, `lint:components` and `gen-mcp-action-docs` (they use the JS API that 7
  dropped). `turbo.json` adds the wrapper to `typecheck`'s inputs.
- **Parallel jobs:** `lint` (lint + sweeps), `typecheck` (`--concurrency=2`) and `test`.
- **Test shards:** `api`, `core`, `apps` (admin, storefront, shopify-import, affiliates, reviews)
  and `rest` (everything else, by exclusion). Balanced on the 2026-11-02 CI times.
- **Turbo cache on CI:** `.turbo/cache` saved with `actions/cache` per job/shard; PRs restore
  `dev`'s entries.
- `bun run affected` compares against `origin/dev` (was `origin/main`; `dev` is the base branch).
