/**
 * Currency-aware money formatting. Pure, zero runtime dependencies, safe to import from
 * client components as well as server code — this is the one place `Intl.NumberFormat`
 * should be called for money in the repo (see `scripts/sweeps/money-format.test.ts`).
 *
 * Amounts are always integer minor units (paise for INR, cents for USD/EUR) at rest —
 * in the database, in API payloads, in props. They only become major-unit display
 * strings here, at render time.
 */

export * from './currencies'
export * from './format'
export * from './presentment'
