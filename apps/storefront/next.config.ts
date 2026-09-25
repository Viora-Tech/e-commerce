import { withSentryConfig } from '@sentry/nextjs/config'
import type { NextConfig } from 'next'

const config: NextConfig = {
  reactCompiler: true,
  transpilePackages: [
    '@commerce/db',
    '@commerce/core',
    '@commerce/config',
    '@commerce/blocks',
    '@commerce/payments',
    '@commerce/payments-razorpay',
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
