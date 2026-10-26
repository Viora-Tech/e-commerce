import { fileURLToPath } from 'node:url'
import { withSentryConfig } from '@sentry/nextjs/config'
import type { NextConfig } from 'next'
import { storefrontFrameAncestors } from './src/lib/csp'

// Monorepo root, two levels up from apps/storefront — lets `output: 'standalone'`
// trace workspace packages (packages/*) correctly instead of only this app's
// own node_modules. See deploy/README.md and apps/storefront/Dockerfile.
const monorepoRoot = fileURLToPath(new URL('../..', import.meta.url))

/**
 * Baseline security headers, same set on both apps (see the admin's
 * `next.config.ts`). The script Content-Security-Policy is per request (a fresh
 * nonce each time), so `src/proxy.ts` sets it (`src/lib/csp.ts`); it repeats the
 * frame-ancestors below, which this file keeps for everything the proxy skips.
 */
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
]

// The theme editor previews the storefront inside an iframe on the admin
// origin (see `src/components/theme/theme-preview-bridge.tsx`, which only
// trusts postMessage from this same origin) — frame-ancestors must allow it,
// or the preview iframe simply refuses to render.
const frameAncestors = storefrontFrameAncestors(process.env.ADMIN_URL)

const config: NextConfig = {
  reactCompiler: true,
  // Standalone build for the production Docker image (apps/storefront/Dockerfile): a minimal
  // server.js plus only the node_modules this app actually uses, traced from the monorepo
  // root so workspace packages (packages/*) are included.
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  // The PIN code directory is read by path at run time (`@commerce/shipping/pincode-directory`),
  // which tracing cannot see; without this the image has no City/State autofill.
  outputFileTracingIncludes: { '/**': ['../../packages/shipping/data/pincode-directory.json.gz'] },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...SECURITY_HEADERS,
          // No X-Frame-Options here: it can only express SAMEORIGIN or DENY,
          // and the admin's theme-preview iframe is a different origin, so
          // frame-ancestors (which can list it) is the only header that
          // fits. Browsers that support neither don't get iframe protection,
          // same as any other cross-origin-embed case.
          { key: 'Content-Security-Policy', value: frameAncestors },
        ],
      },
    ]
  },
  transpilePackages: [
    '@commerce/db',
    '@commerce/core',
    '@commerce/config',
    '@commerce/blocks',
    '@commerce/payments',
    '@commerce/payments-cashfree',
    '@commerce/payments-decentro',
    '@commerce/payments-razorpay',
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
      // Local storage provider (the built-in default): images are served from the admin
      // app's own origin (`/uploads/[...key]`), which may be a different host than the storefront.
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
        : []),
    ],
    // Most product imagery goes through `<Picture>` (packages/core media-loader), which
    // already serves pre-generated AVIF/WebP variants directly and never touches this
    // optimizer. This only covers what still does: blog/CMS content images and anything
    // referencing unprocessed/legacy media — worth AVIF-first there too.
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
