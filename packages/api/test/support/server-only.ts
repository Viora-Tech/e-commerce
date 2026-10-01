/**
 * Test stand-in for the `server-only` package. Next sets the `react-server` export condition
 * (where `server-only` is empty); vitest does not, so the real package throws on import. The
 * cross-store leak test imports the storefront's `server-only` loaders directly and must not
 * skip them, so `vitest.config.ts` aliases `server-only` here.
 */
export {}
