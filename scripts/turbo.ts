/**
 * `turbo` with one local cache shared by every git worktree of this repo, so a
 * typecheck or test another agent already ran on the same inputs is a cache hit
 * here too. Used by the root `test`, `typecheck`, `affected` and `turbo:shared`
 * scripts; `build` stays plain `turbo` because the Docker builds run it in a
 * pruned tree without this file.
 *
 * Cache folder, first match wins:
 *   1. `TURBO_CACHE_DIR` (set it machine-wide to share across clones as well);
 *   2. `<main checkout>/.turbo/cache`, the main checkout's own default, found
 *      through `git rev-parse --git-common-dir` (the same folder in every worktree);
 *   3. turbo's default `.turbo/cache` when git isn't available.
 *
 * Usage: `bun scripts/turbo.ts run typecheck test --filter=@commerce/core`.
 * See docs/guardrails.md, "Testing fast".
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

function sharedCacheDir(): string | null {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: turbo's own setting, read before turbo starts; no task reads it
  const fromEnv = process.env.TURBO_CACHE_DIR?.trim()
  if (fromEnv) return fromEnv
  const git = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    encoding: 'utf8',
  })
  const commonDir = git.status === 0 ? git.stdout.trim() : ''
  return commonDir ? join(dirname(commonDir), '.turbo', 'cache') : null
}

/** This checkout's own turbo binary, so it works outside `bun run` (no `.bin` on PATH) too. */
function turboBin(): string {
  const bin = join(import.meta.dirname, '..', 'node_modules', '.bin', 'turbo')
  const path = process.platform === 'win32' ? `${bin}.exe` : bin
  return existsSync(path) ? path : 'turbo'
}

const cacheDir = sharedCacheDir()
const env = cacheDir ? { ...process.env, TURBO_CACHE_DIR: cacheDir } : process.env
const result = spawnSync(turboBin(), process.argv.slice(2), { stdio: 'inherit', env })
if (result.error) throw result.error
process.exit(result.status ?? 1)
