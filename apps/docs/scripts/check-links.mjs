/**
 * Fails when a docs page, or a link in data/, points at an internal page that does not exist
 * (old URLs that only work through a redirect count as broken: update the link).
 * Run on its own: `bun run check:links`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const content = join(root, 'content')
const pageExists = (url) => {
  const path = join(content, url)
  return existsSync(`${path}.mdx`) || existsSync(join(path, 'index.mdx'))
}
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  )

const sources = [...walk(content).filter((f) => f.endsWith('.mdx')), ...walk(join(root, 'data'))]
const linkPattern = /(?:\]\(|href: ')(\/(?:merchant-guide|developer-docs)[^)'#\s]*)/g
const problems = []
for (const file of sources) {
  for (const [, url] of readFileSync(file, 'utf8').matchAll(linkPattern)) {
    if (!pageExists(url)) problems.push(`${file.slice(root.length + 1)}: ${url}`)
  }
}
if (problems.length > 0) {
  console.error(`Broken internal docs links:\n${problems.map((p) => `  ${p}`).join('\n')}`)
  process.exit(1)
}
console.log('Docs links ok.')
