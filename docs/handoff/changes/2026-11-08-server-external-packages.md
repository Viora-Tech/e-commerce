# Server-only libraries load at run time, not from the bundle (8 Nov 2026)

`next build` for admin peaks about 8.5% lower: 5.35 → 4.90 GB. The figure is the mean of three
cold builds each, in Docker with 2 CPUs. The peak is the container's anonymous memory, sampled
every 0.5 s.

## What changed
- `packages/config/src/server-external-packages.ts` (`SERVER_EXTERNAL_PACKAGES`) is the shared
  `serverExternalPackages` list for both apps' `next.config.ts`. It keeps the old three (`postgres`,
  `@react-pdf/renderer`, `pdf-lib`) and adds plain Node libraries the server bundles used to
  compile:
  - mjml, liquidjs, sanitize-html, happy-dom (from Puck's `@tiptap/html`);
  - drizzle-orm, kysely, `@simplewebauthn/server`;
  - razorpay, `@ai-sdk/gateway`, `@openrouter/ai-sdk-provider`, unpdf, `@growthbook/growthbook`;
  - bullmq, undici;
  - Sentry's server SDK: `@sentry/core`, `@sentry/node`, `@sentry/server-utils` and
    `@opentelemetry/api`.

  `output: 'standalone'` traces each one into the image.
- Kept bundled on purpose:
  - `ioredis`, `ai` and the AWS SDK: Sentry's build-time instrumentation only adds tracing spans
    to bundled packages. Externalizing them as well would save about 8% more (measured), but the
    10% server traces would lose their Redis, AI and S3/SES spans.
  - React-rendering libraries such as `@react-email/*`.
- `packages/shipping/src/pincode-directory.ts` and `packages/core/src/providers/local-storage.ts`
  now carry `turbopackIgnore` comments on their runtime path joins. Turbopack warned that each
  one "causes tracing of the whole project" (11,964 files). The PIN code file still reaches the
  image through `outputFileTracingIncludes`. Upload folders are runtime data.

## Checked
- Both images build and boot to the env check. Inside each image, every external `require`s
  from the server's folder.
- typecheck, biome, `lint:components` and sweeps pass.
