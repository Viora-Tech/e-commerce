/**
 * An imported theme writes its links from Shopify's `routes` and object URLs (`/collections/all`,
 * `/products/x`), which carry no market prefix. In a subfolder market (`/ae`) every one of them
 * would leave the market and come back through a redirect, and crawlers would see the UAE pages
 * link to the India ones. Shopify prefixes them all; this does the same to the rendered HTML.
 */

/** Paths that are the same in every market: our endpoints, assets and the app's own files. */
const SHARED = ['/theme-actions', '/cdn', '/_next', '/api', '/assets', '/files', '/favicon']

const LINK = /\b(href|action)=(["'])(\/(?!\/)[^"']*)\2/g

/** `path` under `prefix`, unless it is shared by every market or already there. */
export function marketHref(path: string, prefix: string): string {
  if (!prefix || prefix === '/' || !path.startsWith('/') || path.startsWith('//')) return path
  if (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)) return path
  if (SHARED.some((p) => path === p || path.startsWith(`${p}/`))) return path
  return path === '/' ? prefix : `${prefix}${path}`
}

/** `html` with every same-site `href` and `action` moved under `prefix`; unchanged without one. */
export function withMarketPrefix(html: string, prefix: string): string {
  if (!prefix || prefix === '/') return html
  return html.replace(LINK, (_, attr: string, quote: string, path: string) => {
    return `${attr}=${quote}${marketHref(path, prefix)}${quote}`
  })
}
