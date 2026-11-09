/**
 * The chat frame takes on the look of the page around it (`components/inbox/chat-frame.tsx`). On
 * the React page the chat card sits in the theme's document and inherits its root font size,
 * colour tokens and fonts; inside its own frame it would not, so these are copied from the page
 * (same origin) when the frame starts: the root `font-size` (a theme at 62.5% sizes the card's
 * rem like the page), the custom properties the chat reads, the body font for "inherit the
 * theme's font", and the page's web fonts (font stylesheets and `@font-face` rules, their URLs
 * made absolute). Browser only.
 */

/** The theme tokens `ChatWidget` and its parts read (with their own fallbacks). */
const TOKENS = [
  '--color-bg',
  '--color-ink',
  '--color-surface',
  '--color-line',
  '--color-muted',
  '--color-success',
  '--btn-bg',
  '--btn-text',
  '--font-body',
]

/** `url(...)` in a rule's text, resolved against the stylesheet it came from. */
const absolute = (css: string, base: string) =>
  css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (_, q: string, url: string) => {
    try {
      return `url(${q}${new URL(url, base).href}${q})`
    } catch {
      return `url(${q}${url}${q})`
    }
  })

export function adoptPageLook(): void {
  let page: Document
  try {
    page = window.parent.document
  } catch {
    return
  }
  if (page === document) return
  const root = document.documentElement
  const pageRoot = getComputedStyle(page.documentElement)
  root.style.fontSize = pageRoot.fontSize
  for (const name of TOKENS) {
    const value = pageRoot.getPropertyValue(name).trim()
    if (value) root.style.setProperty(name, value)
  }
  const body = getComputedStyle(page.body)
  document.body.style.fontFamily = body.fontFamily
  document.body.style.color = body.color
  // The page's web fonts: stylesheets from a font service as links, same-origin @font-face as text.
  const faces: string[] = []
  for (const link of page.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')) {
    if (!/fonts\.(googleapis|bunny)\.|fonts\.shopifycdn|font/i.test(link.href)) continue
    const copy = document.createElement('link')
    copy.rel = 'stylesheet'
    copy.href = link.href
    document.head.appendChild(copy)
  }
  for (const sheet of page.styleSheets) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of rules) {
      if (rule instanceof CSSFontFaceRule) {
        faces.push(absolute(rule.cssText, sheet.href ?? page.baseURI))
      }
    }
  }
  if (faces.length) {
    const style = document.createElement('style')
    style.textContent = faces.join('\n')
    document.head.appendChild(style)
  }
}
