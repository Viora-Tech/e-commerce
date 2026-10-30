# `bun run check:changed` (30 Oct 2026)

Quick checks for a change instead of the whole repo (owner: full test/lint/build per change
wastes time). Files changed since `origin/dev` (or a given base; committed, staged, unstaged,
new): biome on those files, tsc (incremental) on their packages plus every workspace package
that depends on them, `vitest related` in the touched packages, and the component checker when a
.tsx changed. `--no-test` skips tests. Script: `scripts/check-changed.ts`. The full lint,
typecheck, tests and build still run once on dev before a release.
