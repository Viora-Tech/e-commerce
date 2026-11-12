/**
 * One shopper walk over the storefront's main pages: the command `strobe run` times on each side
 * of an A/B (https://github.com/anomalyco/strobe, `@hona/strobe`, run with bunx; not a dependency).
 *
 *   bun scripts/perf/storefront-pages.ts http://localhost:3100                  (Next, main pages)
 *   PRODUCTS_ONLY=1 bun scripts/perf/storefront-pages.ts http://localhost:3200  (Hono: products)
 *
 *   bunx @hona/strobe run --pin none --reserve-cpus off --power keep --unit ms  *     --primary run.duration --base "<command on side A>" --head "<command on side B>"
 *
 * `--primary run.duration` matters: strobe's default primary is this script's own CPU time. The
 * pin/power flags leave Windows' CPU and power settings alone. Each page must answer 200 with HTML,
 * so a broken side fails instead of looking fast. 12 Nov 2026, 10 products warm: Next 281 ms,
 * Hono 80 ms (−71%, 95% CI −73…−64%).
 */
// biome-ignore lint/suspicious/noUndeclaredEnvVars: a local perf script, not a turbo task
const { BASE, HANDLES, PRODUCTS_ONLY } = process.env
const base = (process.argv[2] ?? BASE ?? 'http://localhost:3100').replace(/\/$/, '')
const products = (
  HANDLES ??
  'claw-aquila-speed,1337gear-shion-glasspad,aeperion-shimo-quartz,demon-slayer-es2-nezuko'
).split(',')

// PRODUCTS_ONLY=1 for Next vs Hono: Hono renders product pages only, Next answers the rest.
const productPaths = products.map((h) => `/products/${h}`)
const paths =
  PRODUCTS_ONLY === '1'
    ? productPaths
    : ['/', '/collections/all-products', ...productPaths, '/cart', '/search?q=mouse']

for (const path of paths) {
  const res = await fetch(base + path, { headers: { accept: 'text/html' }, redirect: 'manual' })
  const body = await res.text()
  if (res.status !== 200 || !body.includes('</html>')) {
    console.error(`${path} -> ${res.status} (${body.length} bytes)`)
    process.exit(1)
  }
}
