/** SOURCE OF TRUTH: platform console filters — WHAT: the store states and audit sources the console's lists filter on / WHY: one list for the API's input schema and the admin's tabs, importable without the database driver (`@commerce/core/platform`) */

/** Plan states the store list filters on; `none` is a store with no plan row yet. */
export const PLATFORM_STORE_STATES = ['active', 'trialing', 'paused', 'cancelled', 'none'] as const
export type PlatformStoreState = (typeof PLATFORM_STORE_STATES)[number]

/** `console`: what staff read in the platform console. `store`: store exports and deletions. */
export const PLATFORM_AUDIT_SOURCES = ['console', 'store'] as const
export type PlatformAuditSource = (typeof PLATFORM_AUDIT_SOURCES)[number]
