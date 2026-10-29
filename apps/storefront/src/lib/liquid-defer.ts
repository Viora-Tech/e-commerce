/**
 * An imported Shopify theme's deferred scripts wait for React. On Shopify a `defer` or module
 * script runs once the page is parsed; here the same page is also a React tree, and a theme
 * script that runs first can change markup React is about to hydrate (Zero Drift's lens zoom
 * adds a span to the product gallery our own product section draws). React then throws the
 * whole tree away and rebuilds it on the client, and every section's markup comes back through
 * `innerHTML`: its inline scripts never run again and everything the theme had already bound
 * (reveals, meteors, rotating words) is gone.
 *
 * So the deferred scripts are parked, unchanged, as inert `<script type="text/x-theme-deferred">`
 * placeholders, and `window.__commerceBootTheme` (`lib/liquid-shim.ts`) runs them in document
 * order once React has hydrated (`components/theme/liquid-boot.tsx`). Classic inline scripts
 * (setting the `js` class, theme settings JSON) still run where they are, as on Shopify; data
 * scripts (`application/json`, `ld+json`) are left alone, except an empty `ld+json` one (Shopify's
 * `structured_data` filter renders nothing here, as our own JSON-LD covers the page), which
 * search engines report as unparsable structured data.
 *
 * The "print stylesheet, then all" pattern (`<link media="print" onload="this.media='all'">`)
 * loses its inline `onload`: our CSP blocks inline event handlers, so the browser logged a CSP
 * error on every page. The link is marked `data-theme-promote` and the shim switches it on.
 */

/** The placeholder type: not JavaScript, so the browser neither runs nor CSP-checks it. */
export const DEFERRED_TYPE = 'text/x-theme-deferred'

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi
const ATTR = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
const LINK = /<link\b([^>]*)>/gi
const PROMOTE = /this\.media\s*=\s*['"]all['"]/
/** The attribute the shim (`lib/liquid-shim.ts`) looks for to switch a print stylesheet on. */
export const PROMOTE_ATTR = 'data-theme-promote'

function attributes(source: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of source.matchAll(ATTR)) {
    const name = m[1]?.toLowerCase()
    if (name) out.set(name, m[2] ?? m[3] ?? m[4] ?? '')
  }
  return out
}

const attrValue = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

/** Whether a script would run after parsing on Shopify (and so can wait for React here). */
function isDeferred(attrs: Map<string, string>): boolean {
  const type = (attrs.get('type') ?? '').trim().toLowerCase()
  if (type === 'module') return true
  if (type && type !== 'text/javascript' && type !== 'application/javascript') return false
  return attrs.has('src') && (attrs.has('defer') || attrs.has('async'))
}

/** A `<link media="print" onload="this.media='all'">` without the handler, marked for the shim. */
function promotableSheets(html: string): string {
  if (!html.includes('onload')) return html
  return html.replace(LINK, (whole, rawAttrs: string) => {
    const attrs = attributes(rawAttrs)
    if (!PROMOTE.test(attrs.get('onload') ?? '') || attrs.get('media') !== 'print') return whole
    const kept = [...attrs.entries()]
      .filter(([name]) => name !== 'onload')
      .map(([name, value]) => (value === '' ? name : `${name}="${attrValue(value)}"`))
    return `<link ${[...kept, PROMOTE_ATTR].join(' ')}>`
  })
}

/** Rendered theme HTML with its deferred and module scripts parked until React has hydrated. */
export function deferThemeScripts(html: string): string {
  const sheets = promotableSheets(html)
  if (!sheets.includes('<script')) return sheets
  return sheets.replace(SCRIPT, (whole, rawAttrs: string, body: string) => {
    const attrs = attributes(rawAttrs)
    const type = (attrs.get('type') ?? '').trim().toLowerCase()
    if (type === 'application/ld+json' && body.trim() === '') return ''
    if (!isDeferred(attrs)) return whole
    const kept = [...attrs.entries()]
      .filter(([name]) => name !== 'type' && name !== 'src' && name !== 'defer' && name !== 'async')
      .map(([name, value]) => (value === '' ? name : `${name}="${attrValue(value)}"`))
    const src = attrs.get('src')
    const module = (attrs.get('type') ?? '').trim().toLowerCase() === 'module'
    const parts = [
      `type="${DEFERRED_TYPE}"`,
      src ? `data-theme-src="${attrValue(src)}"` : '',
      module ? 'data-theme-module' : '',
      ...kept,
    ].filter(Boolean)
    return `<script ${parts.join(' ')}>${src ? '' : body}</script>`
  })
}
