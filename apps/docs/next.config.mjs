import { fileURLToPath } from 'node:url'
import nextra from 'nextra'
import { movedPages } from './redirects.mjs'

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
  // Standalone build for the optional production Docker image (apps/docs/Dockerfile).
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  transpilePackages: ['@commerce/config'],
  images: {
    unoptimized: true,
  },
  // Pages that moved keep their old links working (redirects.mjs; scripts/check-redirects.mjs
  // checks every target exists).
  async redirects() {
    return movedPages.map(([source, destination]) => ({ source, destination, permanent: true }))
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
