/**
 * An imported theme's cookie banner (`<cookie-banner hidden>`, Zero Drift's
 * `sections/cookie-banner.liquid`), shown with the first paint instead of after hydration.
 *
 * The theme's own script unhides the banner. That script is deferred, so here it waits for React
 * (`lib/liquid-defer.ts`) and then for the section's delay setting: the banner appeared 1 to 2
 * seconds after the page, and as the biggest thing painted that late on a text page it set the
 * page's Largest Contentful Paint (about 6.5 s on a phone).
 *
 * So a small inline script right after the element decides while the page is still being parsed:
 * ask when `Shopify.customerPrivacy` says to (our shim, `lib/liquid-shim.ts`, answers from our
 * consent cookie, the only record of consent here).
 *
 * The theme's own "answered recently" stamp in localStorage is not consent and is not trusted: it
 * was set by the same theme on Shopify (same domain, same section key), and by an older banner
 * version, so a shopper who answered on Shopify within 180 days was never asked on Koomerce, had
 * no consent cookie, and no marketing event or server Purchase was ever sent for them. When our
 * cookie holds no answer the stale stamp is removed (so the theme's script agrees) and the banner
 * shows. Once answered, our cookie hides it. Nothing else changes: the theme's script still
 * binds the buttons later (its `show()` does nothing for a banner already shown), every answer
 * still goes through the shim to `ConsentManager`, and no tag loads before a yes. The script only
 * ever reveals; when in doubt (no shim, a theme preview, a `#cookie-settings` link the theme
 * opens itself) it leaves the banner to the theme.
 *
 * A page drawn without the visitor's region (a copy a shared cache may keep) has nothing to
 * decide yet: the script queues itself (`__commerceConsentReveal`) and the shim runs it once the
 * region is known and asks (`window.__commerceConsentRegion`), without moving focus. Where the
 * region does not require consent (Shopify's model) the banner never shows.
 *
 * Its buttons work at once too. The theme's script, which binds them, is one of the parked
 * scripts the shim runs one after another (about 24th of 36 on the Revamp home page): on a slow
 * phone network, or an in-app browser (Instagram, Facebook, Gmail) that stalls one file, the
 * banner sat on screen for seconds, or for good, and "Accept all" did nothing. Until the theme
 * defines `<cookie-banner>`, a click on Accept, Decline, Save or Choose cookies is answered here
 * the way the theme's `record()` does it: stamp, hide, `setTrackingConsent`. Once the theme has
 * defined the element this handler steps aside, so nothing is answered twice.
 */

const BANNER_END = '</cookie-banner>'

/** Runs in the browser, as the element's next sibling; plain ES5 like the theme's own code. */
const REVEAL = `(function(){try{var s=document.currentScript,b=s&&s.previousElementSibling;if(!b||b.localName!=='cookie-banner'||!b.hidden)return;var S=window.Shopify,p=S&&S.customerPrivacy;if(!p||S.designMode||location.hash==='#cookie-settings')return;var go=function(late){if(!b.hidden||!p.shouldShowBanner())return;try{localStorage.removeItem(b.getAttribute('data-storage-key')||'glide:cookie-consent')}catch(e){}b.hidden=false;var r=b.querySelector('[data-cookie-region]');if(r&&!late)r.focus({preventScroll:true});b.addEventListener('click',function(e){var w=window.customElements;if(w&&w.get('cookie-banner'))return;var t=e.target,k=t&&t.closest?function(q){return t.closest(q)}:function(){return null},a,m;if(k('[data-cookie-accept]'))a=m=true;else if(k('[data-cookie-decline]'))a=m=false;else if(k('[data-cookie-save]')){var x=b.querySelector('[data-cookie-analytics]'),y=b.querySelector('[data-cookie-marketing]');a=!!(x&&x.checked);m=!!(y&&y.checked)}else{var f=k('[data-cookie-preferences]'),g=b.querySelector('[data-cookie-panel]');if(f&&g){g.hidden=!g.hidden;f.setAttribute('aria-expanded',String(!g.hidden))}return}try{localStorage.setItem(b.getAttribute('data-storage-key')||'glide:cookie-consent',String(Date.now()))}catch(z){}b.hidden=true;p.setTrackingConsent({analytics:a,marketing:m,preferences:a,sale_of_data:m},function(){})})};if(p.shouldShowBanner())go(false);else if(p.regionPending&&p.regionPending())(window.__commerceConsentReveal=window.__commerceConsentReveal||[]).push(function(){go(true)})}catch(e){}})()`

/**
 * Section HTML with the reveal script after each theme cookie banner. `nonceMark` is what the
 * render writes for the request's CSP nonce (`NONCE_MARK`, swapped per request).
 */
export function revealConsentEarly(html: string, nonceMark: string): string {
  if (!html.includes(BANNER_END)) return html
  return html.replaceAll(BANNER_END, `${BANNER_END}<script nonce="${nonceMark}">${REVEAL}</script>`)
}
