/**
 * The pure side of email designs for the admin's editor (no React Email, no samples): the
 * block types, limits, lock rule, link checks and the `{{name}}` syntax.
 * `@commerce/notifications/design`.
 */
export { isSafeImage, isSafeLink, parseEmailDesign } from './parse'
export { SLOT_KEY, slotKind, slotLocked } from './slots'
export * from './types'
export { fillForCheck, unknownVariables } from './variable-syntax'
