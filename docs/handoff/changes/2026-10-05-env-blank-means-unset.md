# Blank env values mean "not set" (2026-10-05)

`loadEnv` (`packages/config/src/env.ts`) now drops blank values before validating. Dokploy's env
editor and compose's `${KEY:-}` both pass an empty string for an option left empty, and 28
optional keys with `.url()` / `.min(1)` refused to boot on it (seen live: the storefront crashed
on `SENTRY_DSN=`). Required keys left blank still fail, as missing; a non-blank invalid value is
still rejected. Tests in `env.test.ts`.

Noted while verifying: `packages/api/test/analytics.test.ts > analytics.live > counts open carts
and the last hour of orders` failed once in the full parallel run and passes alone, with and
without this change. Flaky under load; not fixed here.
