# The worker image carries the unlimited plan script

Fixes #953. The unlimited store release step (`2026-10-29-unlimited-store.md`) said to run
`bun run platform:unlimited waimers` in the worker container, but the worker image only had
`scripts/reset-store-data.ts`, and no root `package.json` scripts, so it failed and was run by hand.

- `apps/worker/Dockerfile` now also copies `scripts/platform-unlimited.ts` to
  `/repo/apps/worker/ops/platform-unlimited.ts`. Its imports (`@commerce/config`, `core`, `db`)
  are all worker dependencies, so they resolve there.
- Run it from `/repo/apps/worker`: `bun ops/platform-unlimited.ts <slug>` (`--off` to undo).
- New developer docs section: Deployment, "12. Ops scripts in the worker", lists every script
  that runs in the worker (reset, unlimited plan, gateway fee backfill) with its command. Billing
  links to it. Other ops scripts the docs mention (restore, `rotate-secrets`, `platform:invite`)
  run from the `tasks` image, which has the whole repo, so nothing else was missing.
- Also fixed: commit 59a71514 left a literal `\n` in the `bun install` RUN line of the worker
  and storefront Dockerfiles (the shell would run `n bun install ...`). It is a real line break
  again.

Checked with `docker buildx build --check` on both Dockerfiles; no image was built.
