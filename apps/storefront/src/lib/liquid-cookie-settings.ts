import { COOKIE_SETTINGS_HASH } from './cookie-settings'

/**
 * SOURCE OF TRUTH KEYWORDS: withCookieSettingsLink, imported footer Cookie settings link
 * WHAT:  Adds a "Cookie settings" link to an imported theme's rendered footer section.
 * WHY:   Shoppers could not change their cookie answer: the imported theme's banner (and ours)
 *        open again on `#cookie-settings`, but the theme's footer had no link to it. The link is
 *        added after the render cache, so turning it off in Customize shows at once.
 * WHERE: `liquid-theme.ts` (`renderLiquidSections`) for the `footer` section, unless Customize's
 *        "Cookie settings link" is set to Hide (`showsCookieSettingsLink` in core).
 */

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The `<ul>` of policy links (`footer__policies`, `policies`…), opening tag and end. */
function policyList(html: string): { open: RegExpExecArray; end: number } | null {
  const open = /<ul\b[^>]*\bclass="[^"]*polic[^"]*"[^>]*>/i.exec(html)
  if (!open) return null
  const end = html.indexOf('</ul>', open.index + open[0].length)
  return end === -1 ? null : { open, end }
}

/**
 * `html` with a "Cookie settings" link: as one more item of the policy list (copying its first
 * link's class, so it looks like its neighbours), else as a line at the end of the footer. A
 * footer that already links to `#cookie-settings` is left alone.
 */
export function withCookieSettingsLink(html: string, label: string): string {
  if (html.includes(`href="${COOKIE_SETTINGS_HASH}"`)) return html
  const text = escapeHtml(label)
  const list = policyList(html)
  if (list) {
    const inside = html.slice(list.open.index + list.open[0].length, list.end)
    const linkClass = /<a\b[^>]*\bclass="([^"]*)"/i.exec(inside)?.[1]
    const item = `<li><a href="${COOKIE_SETTINGS_HASH}"${linkClass ? ` class="${linkClass}"` : ''}>${text}</a></li>`
    return html.slice(0, list.end) + item + html.slice(list.end)
  }
  const line = `<p class="cookie-settings-link"><a href="${COOKIE_SETTINGS_HASH}">${text}</a></p>`
  const footerEnd = html.lastIndexOf('</footer>')
  return footerEnd === -1 ? html + line : html.slice(0, footerEnd) + line + html.slice(footerEnd)
}
