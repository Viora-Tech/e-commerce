/**
 * The behaviour swap for an imported Shopify theme's own JavaScript (see the swap
 * table, `@commerce/core` theme-import `swap.ts`). Theme JS that is pure look
 * (sliders, reveals, marquees) runs untouched; the calls it makes to Shopify's
 * endpoints are answered by our features instead:
 *
 * - `/cart/add(.js)` → our cart (`/theme-actions/cart-add`), then the cart page.
 * - `/cart.js` → our cart's count and total, in the fields themes read.
 * - `/cart/change.js`, `/cart/update.js`, `/cart/clear.js` → our cart page.
 * - `?section_id=` / `?sections=` (section rendering) → our renderer of the theme's
 *   own section (`/theme-actions/section`), so lazy tabs and carousels fill in.
 * - `/search/suggest` and `/recommendations/products` → empty answers, so the theme
 *   falls back to its search page link and hides the row.
 * - `Shopify.customerPrivacy` (the theme's cookie banner) → our consent: whether to ask
 *   comes from our consent cookie, and the answer goes to `ConsentManager`
 *   (`commerce:consent` event), which stores it and loads the allowed tags.
 *
 * Inline, before any theme script, with the request's CSP nonce.
 */
export type LiquidShimConfig = {
  /** No consent stored yet (or for an older banner version): the theme's banner may ask. */
  askConsent: boolean
}

export function liquidShim(config: LiquidShimConfig): string {
  return SHIM.replace('__CONFIG__', JSON.stringify(config).replace(/</g, '\\u003c'))
}

const SHIM = `(function () {
  if (window.__commerceShim) return;
  window.__commerceShim = true;
  var config = __CONFIG__;
  var consent = {
    shouldShowBanner: function () { return config.askConsent; },
    setTrackingConsent: function (choice, done) {
      config.askConsent = false;
      window.dispatchEvent(new CustomEvent('commerce:consent', {
        detail: { analytics: !!(choice && choice.analytics), marketing: !!(choice && choice.marketing) }
      }));
      if (typeof done === 'function') done();
    },
    analyticsProcessingAllowed: function () { return false; },
    marketingAllowed: function () { return false; }
  };
  window.Shopify = window.Shopify || {};
  window.Shopify.routes = window.Shopify.routes || { root: '/' };
  window.Shopify.locale = 'en';
  window.Shopify.country = 'IN';
  window.Shopify.currency = { active: 'INR', rate: '1.0' };
  window.Shopify.customerPrivacy = consent;
  window.Shopify.loadFeatures = function (features, done) {
    setTimeout(function () { if (typeof done === 'function') done(null); }, 0);
  };
  var nativeFetch = window.fetch.bind(window);
  var pending = function () { return new Promise(function () {}); };
  var reply = function (body, type) {
    return Promise.resolve(new Response(body, { status: 200, headers: { 'content-type': type } }));
  };
  function toUrl(input) {
    try { return new URL(typeof input === 'string' ? input : input && input.url, location.href); }
    catch (e) { return null; }
  }
  function addToCart(init) {
    var body = init && init.body;
    var headers = {};
    if (typeof body === 'string') headers['content-type'] = 'application/json';
    return nativeFetch('/theme-actions/cart-add', {
      method: 'POST', body: body, headers: Object.assign(headers, { accept: 'application/json' })
    }).then(function (res) {
      if (res.ok) { location.href = '/cart'; return pending(); }
      return res;
    });
  }
  function sectionUrl(url) {
    var id = url.searchParams.get('section_id') || (url.searchParams.get('sections') || '').split(',')[0];
    var q = new URLSearchParams({ section_id: id, path: url.pathname, sections: url.searchParams.has('sections') ? '1' : '' });
    return '/theme-actions/section?' + q.toString();
  }
  window.fetch = function (input, init) {
    var url = toUrl(input);
    if (!url || url.origin !== location.origin) return nativeFetch(input, init);
    var path = url.pathname.replace(/\\/$/, '');
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (/^\\/cart\\/add(\\.js)?$/.test(path)) return addToCart(init);
    if (path === '/cart.js') return nativeFetch('/theme-actions/cart', { headers: { accept: 'application/json' } });
    if (/^\\/cart\\/(change|update|clear)(\\.js)?$/.test(path)) { location.href = '/cart'; return pending(); }
    if (/^\\/search\\/suggest/.test(path)) {
      return path.slice(-5) === '.json'
        ? reply('{"resources":{"results":{"products":[],"collections":[],"pages":[],"articles":[],"queries":[]}}}', 'application/json')
        : reply('', 'text/html');
    }
    if (/^\\/recommendations\\/products/.test(path)) return reply('', 'text/html');
    if (method === 'GET' && (url.searchParams.has('section_id') || url.searchParams.has('sections'))) {
      return nativeFetch(sectionUrl(url), init);
    }
    return nativeFetch(input, init);
  };
})();`
