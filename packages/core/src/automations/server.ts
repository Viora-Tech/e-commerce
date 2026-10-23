/** SOURCE OF TRUTH: Automations server barrel — WHAT: the engine's server surface as `@commerce/core/automations/server` (piece registry, executor contract, and the engine as it lands) / WHY: the API and the worker import one path; the pure parts stay importable from `@commerce/core/automations` for the browser. */

export * from './actions'
export * from './client'
export * from './conditions'
export * from './executor'
export * from './registry'
