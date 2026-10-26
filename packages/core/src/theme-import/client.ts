/** SOURCE OF TRUTH: the browser-safe half of theme import — WHAT: re-exports the schema reader, editor fields, report and swap table for the admin / WHY: client components must not import the server barrel (it pulls the database driver into the browser) */
export * from './app-block-slots'
export * from './fields'
export { numericId } from './numeric-id'
export * from './report'
export * from './schema'
export * from './swap'
