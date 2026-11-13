import { dirname, join } from 'node:path'
import { plugin } from 'bun'

/**
 * Runs before the server (bunfig.toml `preload`). The storefront's library modules guard
 * themselves with `import 'server-only'` and read the request through `next/headers`; outside
 * Next the first throws and the second has no request. Both are swapped here, so the very same
 * modules (loaders, Liquid engine, render cache) run unchanged.
 */
const shim = Bun.fileURLToPath(new URL('./next-headers.ts', import.meta.url))
const memo = Bun.fileURLToPath(new URL('./react-cache.ts', import.meta.url))

plugin({
  name: 'storefront-hono-next-shims',
  setup(build) {
    build.onLoad({ filter: /[\\/](server-only|client-only)[\\/]index\.js$/ }, () => ({
      contents: 'export {}',
      loader: 'js',
    }))
    build.onLoad({ filter: /[\\/]next[\\/]headers\.js$/ }, () => ({
      contents: `export * from ${JSON.stringify(shim)}`,
      loader: 'js',
    }))
    // React itself, with `cache` memoising per request as it does in a Next server render.
    build.onLoad({ filter: /[\\/]node_modules[\\/]react[\\/]index\.js$/ }, (args) => {
      const flavour = process.env.NODE_ENV === 'production' ? 'production' : 'development'
      const real = join(dirname(args.path), 'cjs', `react.${flavour}.js`)
      return {
        contents: [
          `import React from ${JSON.stringify(real)};`,
          `import { requestCache } from ${JSON.stringify(memo)};`,
          'React.cache = requestCache;',
          `export * from ${JSON.stringify(real)};`,
          'export { requestCache as cache };',
          'export default React;',
        ].join('\n'),
        loader: 'js',
      }
    })
  },
})
