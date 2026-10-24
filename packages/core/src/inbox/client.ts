/** SOURCE OF TRUTH: `@commerce/core/inbox` — WHAT: the pure half of Inbox (word lists, settings schema and availability, access and spam rules) / WHY: admin and storefront client components import it without pulling the database driver into the browser. */
export * from './connection'
export * from './constants'
export * from './rules'
export * from './settings'
