/**
 * Server-only libraries both Next apps load with Node's `require` at run time instead of
 * bundling them (`serverExternalPackages`). Each one is plain Node code that works the same
 * either way; bundling it only made `next build` compile it again for every server layer.
 * Measured on admin (8 Nov 2026, Docker, 2 CPUs, three builds each): peak build memory 5.35 →
 * 4.90 GB (-8.5%). `output: 'standalone'` traces each one into the image.
 *
 * Kept bundled on purpose:
 * - `ioredis`, `ai`, the AWS SDK: Sentry's build-time instrumentation adds tracing spans to
 *   them only when they are bundled (@sentry/nextjs keeps `ioredis` bundled for this reason).
 *   `bullmq` is safe to externalize: it takes our bundled `ioredis` connection and checks it
 *   by shape, not by class.
 * - Libraries that render React (e.g. `@react-email/*`), so they keep using the React the
 *   bundle uses. `@react-pdf/renderer` is the old exception: it has to read fonts at run time.
 *
 * Next already externalizes its own list (sharp, jsdom, `@aws-sdk/client-s3`, ...); this adds
 * to it. Both apps' next.config.ts import this file by relative path, like lean-build.ts.
 */
export const SERVER_EXTERNAL_PACKAGES = [
  // Already external before (they load fonts, wasm or native code at run time).
  'postgres',
  '@react-pdf/renderer',
  'pdf-lib',
  // Email and HTML: mjml pulls in cheerio, htmlnano, js-beautify, js-yaml and lodash.
  'mjml',
  'liquidjs',
  'sanitize-html',
  'happy-dom',
  // Data and auth.
  'drizzle-orm',
  'kysely',
  '@simplewebauthn/server',
  // Payments, AI providers, PDF text, experiments, queues.
  'razorpay',
  '@ai-sdk/gateway',
  '@openrouter/ai-sdk-provider',
  'unpdf',
  '@growthbook/growthbook',
  'bullmq',
  'undici',
  // Sentry's server SDK (about 2,400 modules across the server layers).
  '@sentry/core',
  '@sentry/node',
  '@sentry/server-utils',
  '@opentelemetry/api',
]
