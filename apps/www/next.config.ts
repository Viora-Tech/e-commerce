import type { NextConfig } from 'next'

// A static export (out/) served by Cloudflare Workers static assets, see wrangler.jsonc. What a
// server used to add lives in Cloudflare: www → koomerce.app is a zone redirect rule, and the
// security headers are public/_headers.
const config: NextConfig = {
  reactCompiler: true,
  // Lets a one-off `next build` run beside a live dev server without touching its .next folder.
  // Only set when asked: with a distDir the export lands there instead of out/.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  output: 'export',
  // No image server in a static export; images ship as they are in public/.
  images: { unoptimized: true },
  transpilePackages: ['@commerce/config', '@commerce/ui'],
}

export default config
