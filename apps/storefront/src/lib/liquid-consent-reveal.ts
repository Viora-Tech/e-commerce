/**
 * An imported theme's cookie banner (`<cookie-banner hidden>`, Zero Drift's
 * `sections/cookie-banner.liquid`), shown with the first paint instead of after hydration.
 *
 * The theme's own script unhides the banner. That script is deferred, so here it waits for React
 * (`lib/liquid-defer.ts`) and then for the section's delay setting: the banner appeared 1 to 2
 * seconds after the page, and as the biggest thing painted that late on a text page it set the
 * page's Largest Contentful Paint (about 6.5 s on a phone).
 *
 * So a small inline script right after the element makes the same decision the theme's script
 * makes, while the page is still being parsed: ask only if `Shopify.customerPrivacy` says to (our
 * shim, `lib/liquid-shim.ts`, answers from the consent cookie) and the theme's own "answered
 * recently" stamp in localStorage is not set. Nothing else changes: the theme's script still
 * binds the buttons later (its `show()` does nothing for a banner already shown), every answer
 * still goes through the shim to `ConsentManager`, and no tag loads before a yes. The script only
 * ever reveals; when in doubt (no shim, a theme preview, a `#cookie-settings` link the theme
 * opens itself) it leaves the banner to the theme.
 */

const BANNER_END = '</cookie-banner>'

/** Runs in the browser, as the element's next sibling; plain ES5 like the theme's own code. */
const REVEAL = `(function(){try{var s=document.currentScript,b=s&&s.previousElementSibling;if(!b||b.localName!=='cookie-banner'||!b.hidden)return;var S=window.Shopify,p=S&&S.customerPrivacy;if(!p||S.designMode||location.hash==='#cookie-settings'||!p.shouldShowBanner())return;var d=Number(b.getAttribute('data-remember-days'));if(!isFinite(d)||d<1)d=180;var t=0;try{t=Number(localStorage.getItem(b.getAttribute('data-storage-key')||'glide:cookie-consent'))}catch(e){}if(t&&Date.now()-t<d*864e5)return;b.hidden=false;var r=b.querySelector('[data-cookie-region]');if(r)r.focus({preventScroll:true})}catch(e){}})()`

/**
 * Section HTML with the reveal script after each theme cookie banner. `nonceMark` is what the
 * render writes for the request's CSP nonce (`NONCE_MARK`, swapped per request).
 */
export function revealConsentEarly(html: string, nonceMark: string): string {
  if (!html.includes(BANNER_END)) return html
  return html.replaceAll(BANNER_END, `${BANNER_END}<script nonce="${nonceMark}">${REVEAL}</script>`)
}
