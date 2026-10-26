/**
 * Imported Shopify themes ship unlayered CSS (`h2 { text-transform: uppercase; font: … }`,
 * `p { margin: … }`), and unlayered rules beat Tailwind's layered utilities. The chat's roots
 * (the launcher and the chat card) carry this guard: every descendant gets its typography and
 * margins reset with `!important` at zero specificity (`:where(root) *`), so no theme rule for
 * those properties applies inside the chat. The widget's own typography utilities are `!` too
 * (one class beats `:where()`), which `inbox-guard.test.ts` checks.
 */
export const CHAT_GUARD = [
  '[:where(&)_*]:m-0!',
  '[:where(&)_*]:normal-case!',
  '[:where(&)_*]:[letter-spacing:normal]!',
  '[:where(&)_*]:[word-spacing:normal]!',
  '[:where(&)_*]:[font-family:inherit]!',
  '[:where(&)_*]:[font-size:inherit]!',
  '[:where(&)_*]:[font-weight:inherit]!',
  '[:where(&)_*]:[font-style:normal]!',
  '[:where(&)_*]:[line-height:inherit]!',
  '[:where(&)_*]:[text-shadow:none]!',
].join(' ')

/** The chat's font: the theme's body font, or the system font when the merchant turned that off. */
export const chatFontFamily = (inheritFont: boolean): string =>
  inheritFont
    ? 'var(--font-body, inherit)'
    : 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
