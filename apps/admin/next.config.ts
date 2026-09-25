import { withSentryConfig } from '@sentry/nextjs/config'
import type { NextConfig } from 'next'

/**
 * Baseline security headers, same set on both apps (see storefront's
 * `next.config.ts`). No script CSP yet — the block list of inline
 * scripts/styles both apps would need is real work; tracked as a follow-up,
 * not silently skipped.
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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...SECURITY_HEADERS,
          // Legacy fallback for browsers that ignore frame-ancestors; SAMEORIGIN
          // matches the CSP's 'self' below (DENY would be stricter and wrong).
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        ],
      },
    ]
  },
  transpilePackages: [
    '@commerce/db',
    '@commerce/core',
    '@commerce/config',
    '@commerce/api',
    '@commerce/auth',
    '@commerce/ui',
    '@commerce/storage',
    '@commerce/invoices',
    '@commerce/plugin-gst-invoices',
    '@commerce/plugin-shopify-import',
  ],
  // react-pdf and pdf-lib load fonts and wasm at runtime; keep them out of the bundle.
  serverExternalPackages: ['postgres', '@react-pdf/renderer', 'pdf-lib'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      ...(process.env.R2_PUBLIC_BASE_URL
        ? [
            {
              protocol: 'https' as const,
              hostname: new URL(process.env.R2_PUBLIC_BASE_URL).hostname,
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
