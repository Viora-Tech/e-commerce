/**
 * Every package's `typecheck` script: `tsc --noEmit` with TypeScript 7 (the native Go compiler,
 * installed as `typescript7`), about 4x faster than TypeScript 5.9 on this repo with the same
 * results (62/62 packages, 0 errors either way, measured 2026-11-03).
 *
 * TypeScript 5.9 (`typescript`) stays installed and keeps the `tsc` command: Next.js, the guardrail
 * sweeps, `lint:components` and `gen-mcp-action-docs` use its JavaScript API (`ts.createProgram`),
 * which TypeScript 7 no longer ships (its API is under `typescript/unstable/*`). Move those over
 * and drop 5.9 once that API is stable.
 *
 * Usage (from a package folder): `bun ../../scripts/typecheck.ts [extra tsc flags]`.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
// The package's exports map hides bin/, so find the folder through its package.json.
const tsc = join(dirname(require.resolve('typescript7/package.json')), 'bin', 'tsc')
const run = spawnSync('node', [tsc, '--noEmit', ...process.argv.slice(2)], { stdio: 'inherit' })
process.exit(run.status ?? 1)
