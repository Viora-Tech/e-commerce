/**
 * First-load JS per route for a Next 16 app, from its production build output.
 *
 * Next 16 dropped the "First Load JS" column from `next build`, so this reads the same
 * facts from `.next`: the runtime chunks every page loads (`build-manifest.json`'s
 * `rootMainFiles`) plus the entry chunks of each route's layouts and page (the
 * `entryJSFiles` in its `page_client-reference-manifest.js`). Chunks a page only fetches
 * later (`import()`, lazy sections) are not counted, which is the point.
 *
 * Usage (after `next build` in the app):
 *   bun scripts/perf/first-load-js.ts apps/storefront            # table
 *   bun scripts/perf/first-load-js.ts apps/storefront --json     # machine-readable
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { gzipSync } from 'node:zlib'

const appDir = process.argv[2] ?? 'apps/storefront'
const asJson = process.argv.includes('--json')
const next = join(appDir, '.next')

const build = JSON.parse(readFileSync(join(next, 'build-manifest.json'), 'utf8')) as {
  rootMainFiles: string[]
}

function* manifests(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* manifests(path)
    else if (name === 'page_client-reference-manifest.js') yield path
  }
}

const gz = new Map<string, number>()
function gzipped(file: string): number {
  const cached = gz.get(file)
  if (cached !== undefined) return cached
  const size = gzipSync(readFileSync(join(next, file))).length
  gz.set(file, size)
  return size
}

const rows: { route: string; kb: number; chunks: number }[] = []
for (const path of manifests(join(next, 'server', 'app'))) {
  const route = `/${relative(join(next, 'server', 'app'), path).replace(/\/?page_client-reference-manifest\.js$/, '')}`
  // The manifest is `globalThis.__RSC_MANIFEST[...] = {...}`; evaluate it in a scratch global.
  const scope: { __RSC_MANIFEST?: Record<string, { entryJSFiles: Record<string, string[]> }> } = {}
  new Function('globalThis', readFileSync(path, 'utf8'))(scope)
  const manifest = Object.values(scope.__RSC_MANIFEST ?? {})[0]
  if (!manifest) continue
  const files = new Set(build.rootMainFiles)
  for (const list of Object.values(manifest.entryJSFiles)) for (const f of list) files.add(f)
  const bytes = [...files].reduce((sum, f) => sum + gzipped(f), 0)
  rows.push({ route, kb: Math.round((bytes / 1024) * 10) / 10, chunks: files.size })
}
rows.sort((a, b) => a.route.localeCompare(b.route))

if (asJson) console.log(JSON.stringify(rows, null, 2))
else {
  console.log('| Route | First-load JS (gzip) | Chunks |\n| --- | ---: | ---: |')
  for (const r of rows) console.log(`| \`${r.route}\` | ${r.kb.toFixed(1)} kB | ${r.chunks} |`)
}
