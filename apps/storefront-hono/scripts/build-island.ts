import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BunPlugin } from 'bun'
import type { AcceptedPlugin } from 'postcss'

/**
 * Bundles the buy box island (`src/island/client.ts`) for the browser into `dist/island/`:
 * hashed ES modules (the entry and the chunks it loads on demand) and `manifest.json` naming the
 * entry and each file's size. The server reads the manifest (`src/island/assets.ts`).
 *
 * The storefront modules the buy box imports keep their Next shape. Three of them are server
 * actions, which a browser bundle cannot run: they are swapped for `src/island/actions.ts`, which
 * calls the same actions on the Next storefront. Anything that still reaches `server-only` fails
 * the build, so no server code ends up in the browser.
 *
 * Usage: `bun scripts/build-island.ts` (also `bun run build:island`).
 */

const root = join(import.meta.dir, '..')
const out = join(root, 'dist', 'island')
const actions = join(root, 'src', 'island', 'actions.ts')

/** The server actions the buy box imports, by the storefront file that holds them. */
const SERVER_ACTIONS =
  /[\\/]apps[\\/]storefront[\\/]src[\\/]lib[\\/](cart|shipping|back-in-stock)-actions\.ts$/

const islandShims: BunPlugin = {
  name: 'hono-island-shims',
  setup(build) {
    build.onLoad({ filter: SERVER_ACTIONS }, () => ({
      contents: `export * from ${JSON.stringify(actions)}`,
      loader: 'ts',
    }))
    build.onLoad({ filter: /[\\/]server-only[\\/]index\.js$/ }, (args) => {
      throw new Error(`server-only module reached the island bundle: ${args.path}`)
    })
  },
}

export type IslandManifest = {
  /** The entry file, loaded with `<script type="module">`. */
  entry: string
  /**
   * The Next storefront's global stylesheet (`apps/storefront/src/app/globals.css`: Tailwind and
   * `@commerce/blocks/styles.css`), compiled the way Next compiles it, for the buy box's own CSS.
   */
  css: string
  files: { name: string; bytes: number; gzip: number }[]
}

const storefront = join(root, '..', 'storefront')

/** `globals.css` through Tailwind, scanning what Next's build scans (the storefront, the blocks). */
async function buildCss(): Promise<{ name: string; bytes: Uint8Array<ArrayBuffer> }> {
  const { default: postcss } = await import('postcss')
  const { default: tailwind } = await import('@tailwindcss/postcss')
  const from = join(storefront, 'src', 'app', 'globals.css')
  // Tailwind's plugin is typed against its own postcss copy; the plugin shape is the same.
  const plugin = tailwind({ base: storefront, optimize: { minify: true } }) as AcceptedPlugin
  const result = await postcss([plugin]).process(readFileSync(from, 'utf8'), { from })
  const bytes = new TextEncoder().encode(result.css)
  const hash = Bun.hash(bytes).toString(36).slice(0, 8)
  return { name: `global-${hash}.css`, bytes }
}

export async function buildIsland(): Promise<IslandManifest> {
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const result = await Bun.build({
    entrypoints: [join(root, 'src', 'island', 'client.ts')],
    outdir: out,
    target: 'browser',
    format: 'esm',
    splitting: true,
    minify: true,
    sourcemap: 'none',
    naming: {
      entry: '[name]-[hash].[ext]',
      chunk: 'chunk-[hash].[ext]',
      asset: '[name]-[hash].[ext]',
    },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [islandShims],
  })
  if (!result.success) {
    for (const log of result.logs) console.error(log)
    throw new Error('island build failed')
  }
  const files = await Promise.all(
    result.outputs.map(async (o) => {
      const bytes = new Uint8Array(await o.arrayBuffer())
      return {
        name: o.path.split(/[\\/]/).pop() as string,
        bytes: bytes.byteLength,
        gzip: Bun.gzipSync(bytes).byteLength,
        kind: o.kind,
      }
    }),
  )
  const entry = files.find((f) => f.kind === 'entry-point')
  if (!entry) throw new Error('island build: no entry')
  const css = await buildCss()
  writeFileSync(join(out, css.name), css.bytes)
  files.push({
    name: css.name,
    bytes: css.bytes.byteLength,
    gzip: Bun.gzipSync(css.bytes).byteLength,
    kind: 'asset',
  })
  const manifest: IslandManifest = {
    entry: entry.name,
    css: css.name,
    files: files.map(({ name, bytes, gzip }) => ({ name, bytes, gzip })),
  }
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2))
  return manifest
}

if (import.meta.main) {
  const m = await buildIsland()
  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`
  for (const f of m.files) console.log(`${f.name}  ${kb(f.bytes)}  (gzip ${kb(f.gzip)})`)
  const total = m.files.reduce((a, f) => ({ bytes: a.bytes + f.bytes, gzip: a.gzip + f.gzip }), {
    bytes: 0,
    gzip: 0,
  })
  console.log(`total ${kb(total.bytes)} (gzip ${kb(total.gzip)}); entry ${m.entry}`)
}
