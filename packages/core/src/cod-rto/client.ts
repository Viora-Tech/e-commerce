/** SOURCE OF TRUTH: COD & RTO app, browser-safe entry — WHAT: the settings schema, tags, risk levels and the pure score for admin client components (`@commerce/core/cod-rto`) / WHY: client code must not import the `@commerce/core` barrel, which pulls in the database driver */
export * from './score'
export * from './settings'
