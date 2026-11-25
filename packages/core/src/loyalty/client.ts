/** SOURCE OF TRUTH: Loyalty points app, browser-safe entry — WHAT: the settings schema, defaults, the pure rules, and the v2 input schemas (rules, rewards, tiers, campaigns) for admin and storefront client components (`@commerce/core/loyalty`) / WHY: client code must not import the `@commerce/core` barrel, which pulls in the database driver */
export * from './schemas'
export * from './settings'
