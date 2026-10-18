/**
 * Writes out/_redirects from redirects.mjs after `next build`, so Cloudflare Workers static
 * assets answers every moved page with a 301 (a static export has no redirects of its own).
 * Run by `bun run build` (postbuild).
 */
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { movedPages } from '../redirects.mjs'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'out')
if (!existsSync(out)) {
  console.error('out/ is missing: run `next build` first.')
  process.exit(1)
}
const lines = movedPages.map(([from, to]) => `${from} ${to} 301`)
writeFileSync(join(out, '_redirects'), `${lines.join('\n')}\n`)
console.log(`Wrote out/_redirects (${lines.length}).`)
