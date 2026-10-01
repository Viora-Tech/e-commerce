/**
 * Test stand-in for the `server-only` package: Next sets the `react-server` export condition
 * (where `server-only` is empty), vitest does not, so the real package throws on import.
 * `vitest.config.ts` aliases `server-only` here so `lib/` modules guarded by it stay testable.
 */
export {}
