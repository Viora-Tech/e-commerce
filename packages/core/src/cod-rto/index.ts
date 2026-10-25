/** SOURCE OF TRUTH: COD & RTO app, server entry — WHAT: everything the API, the worker, the storefront and checkout use from the app (settings, scoring, confirmation, reports), re-exported by the `@commerce/core` barrel / WHY: one import site per app, like the other core-hosted apps */
export * from './client'
export * from './confirm'
export * from './overview'
export * from './risk'
