/**
 * SOURCE OF TRUTH KEYWORDS: home page h1, main heading, plain HTML home
 * WHAT:  The home page's one `<h1>`: when the theme's header, sections and footer draw none (a
 *        hero whose first slide has no heading, a theme that puts the logo in a `div`), a
 *        visually hidden `<h1>` with the store's name goes in `<main>`, after the sections
 *        (so the theme's `:first-child` rules see what they did). A theme that
 *        already draws one is left as it is, so the page never gets two.
 * WHY:   Search engines read the h1 as the page's main heading; a home page without one was
 *        flagged in page checks. Hidden with inline styles, so it draws nothing in any theme,
 *        whatever its CSS calls a visually hidden class.
 * WHERE: `render.ts`, for the home page.
 */

const H1 = /<h1[\s>]/i

/** Clip pattern for screen readers and crawlers only; inline, so no theme CSS is needed. */
const HIDDEN =
  'position:absolute;width:0.0625rem;height:0.0625rem;margin:-0.0625rem;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0'

const escapeHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Whether any of the page's parts already draws an `<h1>`. */
export function drawsH1(parts: readonly string[]): boolean {
  return parts.some((html) => H1.test(html))
}

/** The hidden `<h1>` to put in `<main>`, or '' when the page has one or no name to show. */
export function fallbackHomeHeading(storeName: string, parts: readonly string[]): string {
  const name = storeName.trim()
  if (!name || drawsH1(parts)) return ''
  return `<h1 style="${HIDDEN}">${escapeHtml(name)}</h1>`
}
