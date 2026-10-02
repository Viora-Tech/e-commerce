/**
 * The locked checkout's pages: the form, payment, thank-you and balance pages under
 * `/checkout`. They draw their own frame (`components/checkout/checkout-shell.tsx`) and no
 * theme reaches them. Pure and browser safe: the layout and `StoreChrome` both ask.
 */
export const isCheckoutPath = (pathname: string): boolean =>
  pathname === '/checkout' || pathname.startsWith('/checkout/')

/**
 * The imported Shopify theme's page shell for this path, or null on a checkout page. The
 * theme's CSS would restyle the checkout, and its scripts rewrite markup before React
 * hydrates it (Zero Drift's `reveal.js` wraps every `main h1-h3` in a span), which threw
 * React hydration error #418 on `/checkout` and re-rendered the whole page.
 */
export function liquidLayoutForPath<T>(layout: T | null, pathname: string): T | null {
  return isCheckoutPath(pathname) ? null : layout
}
