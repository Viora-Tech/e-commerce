/** SOURCE OF TRUTH: Automations client barrel — WHAT: the pure, browser-safe surface of the engine (definition schema, catalogue, templates, statuses) as `@commerce/core/automations` / WHY: the admin editor imports these without pulling the database driver; server code (`registry`, `engine/**`) is imported by path from `@commerce/core/automations/server`. */
export * from './api-types'
export * from './catalogue'
export * from './definition'
export * from './templates'
export * from './types'
