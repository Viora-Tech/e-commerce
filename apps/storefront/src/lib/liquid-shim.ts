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
 * - `/search/suggest` → an empty answer, so the theme falls back to its search page link.
 * - `/recommendations/products` → the theme's own section rendered with our related
 *   products (`/theme-actions/recommendations`); an empty answer when there are none.
 * - `Shopify.customerPrivacy` (the theme's cookie banner) → our consent: whether to ask
 *   comes from our consent cookie, and the answer goes to `ConsentManager`
 *   (`commerce:consent` event), which stores it and loads the allowed tags.
 * - The theme's deferred and module scripts (parked by `lib/liquid-defer.ts`) →
 *   `window.__commerceBootTheme()`, called once React has hydrated (`liquid-boot.tsx`):
 *   runs them in document order, each external file once, so no theme script edits markup
 *   React is still hydrating. Inline `onload` handlers (blocked by our CSP) on the common
 *   "print stylesheet, then all" pattern are replayed here too.
 * - Sections below the fold (`lib/liquid-fold.ts`): their parked scripts (`data-theme-near`)
 *   run once the rest have, when the section comes within a screen of the viewport, and an
 *   autoplaying video (`data-theme-autoplay`) starts then.
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
    if (/^\\/recommendations\\/products/.test(path)) {
      return nativeFetch('/theme-actions/recommendations' + url.search, { headers: { accept: 'text/html' } })
        .then(function (res) { return res.ok ? res : reply('', 'text/html'); });
    }
    if (method === 'GET' && (url.searchParams.has('section_id') || url.searchParams.has('sections'))) {
      return nativeFetch(sectionUrl(url), init);
    }
    return nativeFetch(input, init);
  };
  var booted = Object.create(null);
  function runParked(node) {
    return new Promise(function (done) {
      var src = node.getAttribute('data-theme-src');
      var key = src ? new URL(src, location.href).href : null;
      if (node.getAttribute('data-theme-ran') || (key && booted[key])) { done(); return; }
      node.setAttribute('data-theme-ran', '1');
      if (key) booted[key] = true;
      var script = document.createElement('script');
      for (var i = 0; i < node.attributes.length; i++) {
        var a = node.attributes[i];
        if (a.name === 'type' || a.name.indexOf('data-theme-') === 0) continue;
        script.setAttribute(a.name, a.value);
      }
      if (node.nonce) script.nonce = node.nonce;
      if (node.hasAttribute('data-theme-module')) script.type = 'module';
      if (src) {
        script.async = false;
        script.onload = script.onerror = function () { done(); };
        script.src = src;
      } else {
        script.textContent = node.textContent;
        setTimeout(done, 0);
      }
      node.parentNode.insertBefore(script, node.nextSibling);
    });
  }
  function promoteSheets() {
    document.querySelectorAll('link[rel="stylesheet"][media="print"][onload]').forEach(function (link) {
      if (!/this\\.media\\s*=\\s*'all'/.test(link.getAttribute('onload') || '')) return;
      var promote = function () { link.media = 'all'; };
      if (link.sheet) promote(); else link.addEventListener('load', promote, { once: true });
    });
  }
  function runInOrder(nodes, chain) {
    return nodes.reduce(function (c, node) {
      return c.then(function () { return runParked(node); });
    }, chain || Promise.resolve());
  }
  function sectionOf(node) {
    return node.closest('.shopify-section') || node.parentElement;
  }
  function whenNear(scripts, videos) {
    var waiting = new Map();
    scripts.forEach(function (node) {
      var box = sectionOf(node);
      if (!box) return;
      if (!waiting.has(box)) waiting.set(box, { scripts: [], videos: [] });
      waiting.get(box).scripts.push(node);
    });
    videos.forEach(function (video) {
      var box = sectionOf(video) || video;
      if (!waiting.has(box)) waiting.set(box, { scripts: [], videos: [] });
      waiting.get(box).videos.push(video);
    });
    if (!waiting.size) return Promise.resolve();
    var chain = Promise.resolve();
    function start(box) {
      var due = waiting.get(box);
      if (!due) return;
      waiting.delete(box);
      chain = runInOrder(due.scripts, chain);
      due.videos.forEach(function (video) {
        video.autoplay = true;
        var played = video.play();
        if (played && played.catch) played.catch(function () {});
      });
    }
    if (!('IntersectionObserver' in window)) {
      Array.from(waiting.keys()).forEach(start);
      return chain;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        start(entry.target);
      });
    }, { rootMargin: '100% 0px' });
    // A section with no box of its own (hidden, display: contents) is never seen: start it now.
    Array.from(waiting.keys()).forEach(function (box) {
      if (box.getClientRects().length) observer.observe(box); else start(box);
    });
    return chain;
  }
  window.__commerceBootTheme = function () {
    promoteSheets();
    var parked = Array.prototype.slice.call(document.querySelectorAll('script[type="text/x-theme-deferred"]'));
    var now = parked.filter(function (node) { return !node.hasAttribute('data-theme-near'); });
    var near = parked.filter(function (node) { return node.hasAttribute('data-theme-near'); });
    var videos = Array.prototype.slice.call(document.querySelectorAll('video[data-theme-autoplay]'));
    return runInOrder(now).then(function () { return whenNear(near, videos); });
  };
})();`
