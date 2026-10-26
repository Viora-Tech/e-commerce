import { fileURLToPath } from 'node:url'
import { withSentryConfig } from '@sentry/nextjs/config'
import type { NextConfig } from 'next'
import { ADMIN_FRAME_ANCESTORS } from './src/lib/csp'
import { SETTINGS_REDIRECTS } from './src/lib/settings-redirects'

// Monorepo root, two levels up from apps/admin — lets `output: 'standalone'`
// trace workspace packages (packages/*) correctly instead of only this app's
// own node_modules. See deploy/README.md and apps/admin/Dockerfile.
const monorepoRoot = fileURLToPath(new URL('../..', import.meta.url))

/**
 * Baseline security headers, same set on both apps (see storefront's
 * `next.config.ts`). The script Content-Security-Policy is per request (a fresh
 * nonce each time), so `src/proxy.ts` sets it on pages (`src/lib/csp.ts`); it
 * repeats the frame-ancestors below, which this file keeps for every route.
 */
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
]

const config: NextConfig = {
  reactCompiler: true,
  // Standalone build for the production Docker image (apps/admin/Dockerfile): a minimal
  // server.js plus only the node_modules this app actually uses, traced from the monorepo
  // root so workspace packages (packages/*) are included.
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  // The PIN code directory is read by path at run time (`@commerce/shipping/pincode-directory`),
  // which tracing cannot see; without this the image has no City/State autofill.
  outputFileTracingIncludes: { '/**': ['../../packages/shipping/data/pincode-directory.json.gz'] },
  // Marketing was renamed to Growth; old links (bookmarks, emails, other apps) keep working.
  async redirects() {
    return [
      { source: '/marketing', destination: '/growth', permanent: true },
      { source: '/marketing/campaigns', destination: '/growth/campaigns', permanent: true },
      {
        source: '/marketing/campaigns/:path*',
        destination: '/growth/campaigns/:path*',
        permanent: true,
      },
      { source: '/marketing/automations', destination: '/growth/automations', permanent: true },
      {
        source: '/marketing/automations/:path*',
        destination: '/growth/automations/:path*',
        permanent: true,
      },
      // Stock pages left Products for their own section (October 2026); old links keep working.
      ...['inventory', 'purchase-orders', 'inbound-shipments', 'suppliers', 'transfers'].flatMap(
        (page) => [
          { source: `/products/${page}`, destination: `/stock/${page}`, permanent: false },
          {
            source: `/products/${page}/:path*`,
            destination: `/stock/${page}/:path*`,
            permanent: false,
          },
        ],
      ),
      // Settings were regrouped (October 2026); every old page address still opens its new home.
      ...SETTINGS_REDIRECTS.map((r) => ({ ...r, permanent: false })),
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...SECURITY_HEADERS,
          // Legacy fallback for browsers that ignore frame-ancestors; SAMEORIGIN
          // matches the CSP's 'self' below (DENY would be stricter and wrong).
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: ADMIN_FRAME_ANCESTORS },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ]
  },
  transpilePackages: [
    '@commerce/ai',
    '@commerce/db',
    '@commerce/core',
    '@commerce/config',
    '@commerce/api',
    '@commerce/auth',
    '@commerce/ui',
    '@commerce/storage',
    '@commerce/invoices',
    '@commerce/plugin-emi',
    '@commerce/plugin-gst-invoices',
    '@commerce/plugin-affiliates',
    '@commerce/plugin-forms',
    '@commerce/plugin-growthbook',
    '@commerce/plugin-reviews',
    '@commerce/plugin-meilisearch',
    '@commerce/plugin-search',
    '@commerce/plugin-search-console',
    '@commerce/plugin-umami',
    '@commerce/plugin-chatwoot',
    '@commerce/plugin-shopify-import',
  ],
  // react-pdf and pdf-lib load fonts and wasm at runtime; keep them out of the bundle.
  serverExternalPackages: ['postgres', '@react-pdf/renderer', 'pdf-lib'],
  images: {
    // Dev only: the built-in local storage serves uploads from localhost, which next/image
    // otherwise refuses as a private address (SSRF guard). Production uses R2/S3 public hosts.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production',
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      // The platform's media bucket (R2 `koomerce-media`), fixed so a build needs no env for it.
      { protocol: 'https', hostname: 'cdn.koomerce.app' },
      ...(process.env.R2_PUBLIC_BASE_URL
        ? [
            {
              protocol: 'https' as const,
              hostname: new URL(process.env.R2_PUBLIC_BASE_URL).hostname,
            },
          ]
        : []),
      // Amazon S3 storage connection: a custom public URL or CloudFront domain typed into
      // the Connect page needs this env var set before the build that serves it, same as R2 above.
      ...(process.env.S3_PUBLIC_BASE_URL
        ? [
            {
              protocol: 'https' as const,
              hostname: new URL(process.env.S3_PUBLIC_BASE_URL).hostname,
            },
          ]
        : []),
      // Local storage provider (the built-in default): `publicUrl` is a fully-qualified
      // URL back to this same app's `/uploads/[...key]` route, so next/image still needs it listed.
      ...(process.env.ADMIN_URL
        ? [
            {
              protocol: new URL(process.env.ADMIN_URL).protocol.replace(':', '') as
                | 'http'
                | 'https',
              hostname: new URL(process.env.ADMIN_URL).hostname,
              port: new URL(process.env.ADMIN_URL).port || undefined,
            },
          ]
        : [{ protocol: 'http' as const, hostname: 'localhost', port: '3200' }]),
    ],
    // The media library grid still uses next/image for arbitrary/unprocessed media; give
    // it AVIF-first too. Product pages use `<Picture>` (packages/core media-loader) directly.
    formats: ['image/avif', 'image/webp'],
  },
}

// GlitchTip needs no source-map upload (that's a Sentry SaaS feature requiring an auth
// token); this only wraps the build to inject release/runtime hooks for instrumentation.ts.
// Dev skips the wrapper: under Turbopack dev it made the first compile run away on memory.
export default process.env.NODE_ENV === 'production'
  ? withSentryConfig(config, {
      silent: true,
      disableLogger: true,
      sourcemaps: { disable: true },
      telemetry: false,
    })
  : config
