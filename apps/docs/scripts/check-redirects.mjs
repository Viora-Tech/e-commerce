/**
 * Fails when a moved-page redirect points at a page that does not exist, or at another
 * redirect (a chain). Run by `bun run build`, or on its own: `bun run check:redirects`.
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { movedPages } from '../redirects.mjs'

const content = join(dirname(fileURLToPath(import.meta.url)), '..', 'content')
const pageExists = (url) => {
  const path = join(content, url)
  return existsSync(`${path}.mdx`) || existsSync(join(path, 'index.mdx'))
}

const sources = new Set(movedPages.map(([from]) => from))
const problems = []
for (const [from, to] of movedPages) {
  if (!pageExists(to)) problems.push(`${from} -> ${to}: target page does not exist`)
  if (sources.has(to)) problems.push(`${from} -> ${to}: target is itself redirected`)
}
if (problems.length > 0) {
  console.error(`Broken docs redirects:\n${problems.map((p) => `  ${p}`).join('\n')}`)
  process.exit(1)
}
console.log(`Docs redirects ok (${movedPages.length}).`)
