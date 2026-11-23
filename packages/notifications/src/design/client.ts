/**
 * The pure side of email designs for the admin's editor (no React Email, no samples): the
 * block types, styles, limits, lock rule, link checks, the HTML cleaner, the rich text marks
 * and the `{{name}}` syntax. `@commerce/notifications/design`.
 */
export {
  checkEmailDesign,
  type DesignCheck,
  isSafeImage,
  isSafeLink,
  parseEmailDesign,
} from './parse'
export { parseStyles } from './parse-style'
export { parseRichText, richToPlain } from './rich-text'
export { sanitizeEmailHtml } from './sanitize-html'
export { SLOT_KEY, slotKind, slotLocked } from './slots'
export * from './style-types'
export * from './types'
export { fillForCheck, unknownVariables } from './variable-syntax'
