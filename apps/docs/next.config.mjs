import { fileURLToPath } from 'node:url'
import nextra from 'nextra'

const withNextra = nextra({
  contentDirBasePath: '/',
  // Adds `readingTime` to each page's front matter; shown by components/reading-time.tsx.
  readingTime: true,
})

/* Nextra turns every ```mermaid block into `<Mermaid />` imported from
   `@theguild/remark-mermaid/mermaid`. Point that import at our themed wrapper (hand-drawn
   look, our colours: lib/mermaid-config.ts). Nextra spreads `turbopack.resolveAlias` after its
   own alias for the same module, so this one wins; `webpack` covers `next build --webpack`. */
const MERMAID_MODULE = '@theguild/remark-mermaid/mermaid'
const MERMAID_WRAPPER = './components/mermaid-alias.ts'

export default withNextra({
  reactStrictMode: true,
  // A static export (out/) served by Cloudflare Workers static assets, see wrangler.jsonc.
  // Moved pages keep their old links through out/_redirects, written after the build from
  // redirects.mjs (scripts/write-redirects.mjs).
  output: 'export',
  transpilePackages: ['@commerce/config'],
  images: {
    unoptimized: true,
  },
  turbopack: {
    resolveAlias: {
      [MERMAID_MODULE]: MERMAID_WRAPPER,
    },
  },
  webpack(config) {
    config.resolve.alias[MERMAID_MODULE] = fileURLToPath(new URL(MERMAID_WRAPPER, import.meta.url))
    return config
  },
})
