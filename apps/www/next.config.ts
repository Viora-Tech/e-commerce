import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

// Monorepo root, two levels up from apps/www, so `output: 'standalone'` traces workspace
// packages (packages/*) instead of only this app's own node_modules.
const monorepoRoot = fileURLToPath(new URL('../..', import.meta.url))

const config: NextConfig = {
  reactCompiler: true,
  // Lets a one-off `next build` run beside a live dev server without touching its .next folder.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ['@commerce/config', '@commerce/ui'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default config
