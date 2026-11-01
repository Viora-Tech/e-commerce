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
 *   own section (`/theme-actions/section`), so lazy tabs and carousels fill in: one section's
 *   HTML, or JSON keyed by every section asked for (`lib/section-rendering.ts`).
 * - `Node#removeChild` / `Node#insertBefore` → follow a node a theme script moved, so React
 *   never throws over markup it draws that the theme rearranged (a heading's reveal span).
 * - `/search/suggest(.json)` → passed through untouched: our own predictive search answers it
 *   in Shopify's shape (`lib/predictive-route.ts`), JSON or the theme's section with results.
 * - `/recommendations/products(.json)` → passed through: our related products answer
 *   in Shopify's shape (`lib/recommendations-route.ts`), JSON or the theme's section filled;
 *   a failed answer reads as an empty row.
 * - `Shopify.customerPrivacy` (the theme's cookie banner) → our consent: whether to ask
 *   comes from our consent cookie, and the answer goes to `ConsentManager`
 *   (`commerce:consent` event), which stores it and loads the allowed tags.
 * - The theme's deferred and module scripts (parked by `lib/liquid-defer.ts`) →
 *   `window.__commerceBootTheme()`, called once React has hydrated (`liquid-boot.tsx`):
 *   runs them in document order, each external file once, so no theme script edits markup
 *   React is still hydrating. The common "print stylesheet, then all" pattern is switched on
 *   here too: `lib/liquid-defer.ts` swaps its inline `onload` (blocked by our CSP) for
 *   `data-theme-promote`.
 * - Sections below the fold (`lib/liquid-fold.ts`): their parked scripts (`data-theme-near`)
 *   run once the rest have, when the section comes within a screen of the viewport, and an
 *   autoplaying video (`data-theme-autoplay`) starts then.
 *
 * Inline, before any theme script, with the request's CSP nonce.
 */
export type LiquidShimConfig = {
  /** No consent stored yet (or for an older banner version): the theme's banner may ask. */
  askConsent: boolean
  /**
   * The market's path prefix (`/ae`), or empty. The theme's links carry it
   * (`lib/liquid-market-links.ts`), so its calls do too: they are matched without it.
   */
  prefix?: string
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
  var prefix = config.prefix || '';
  window.Shopify.routes = window.Shopify.routes || { root: prefix + '/' };
  function unprefixed(pathname) {
    if (prefix && (pathname === prefix || pathname.indexOf(prefix + '/') === 0)) return pathname.slice(prefix.length) || '/';
    return pathname;
  }
  window.Shopify.locale = 'en';
  window.Shopify.country = 'IN';
  window.Shopify.currency = { active: 'INR', rate: '1.0' };
  window.Shopify.customerPrivacy = consent;
  window.Shopify.loadFeatures = function (features, done) {
    setTimeout(function () { if (typeof done === 'function') done(null); }, 0);
  };
  // React draws parts of the theme's page too (the cart, the account, the product). A theme
  // script that moves a node React owns (a reveal wrapping a heading's words in a span) leaves
  // React removing it from, or inserting before it in, a parent it has left: the DOM throws and
  // the page falls to its error screen. These follow the node to where the theme put it.
  var NodeType = window.Node;
  if (NodeType) {
    var removeChild = NodeType.prototype.removeChild;
    var insertBefore = NodeType.prototype.insertBefore;
    NodeType.prototype.removeChild = function (child) {
      if (child instanceof NodeType && child.parentNode !== this) {
        if (child.parentNode) removeChild.call(child.parentNode, child);
        return child;
      }
      return removeChild.call(this, child);
    };
    NodeType.prototype.insertBefore = function (node, ref) {
      if (ref instanceof NodeType && ref.parentNode && ref.parentNode !== this) {
        return insertBefore.call(ref.parentNode, node, ref);
      }
      return insertBefore.call(this, node, ref);
    };
  }
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
      if (res.ok) { location.href = prefix + '/cart'; return pending(); }
      return res;
    });
  }
  function sectionUrl(url) {
    // \`?sections=a,b\` asks for JSON keyed by every section; \`?section_id=\` for one section's HTML.
    var q = new URLSearchParams({ path: unprefixed(url.pathname) });
    // The page's own query goes along: a collection's filters, sort and page shape the section
    // (a product finder asks for \`/collections/mice?filter.p.m.custom.grip=Claw&section_id=…\`).
    url.searchParams.forEach(function (value, key) {
      if (key !== 'path' && key !== 'section_id' && key !== 'sections') q.append(key, value);
    });
    if (url.searchParams.has('sections')) q.set('sections', url.searchParams.get('sections') || '');
    else q.set('section_id', url.searchParams.get('section_id') || '');
    return '/theme-actions/section?' + q.toString();
  }
  window.fetch = function (input, init) {
    var url = toUrl(input);
    if (!url || url.origin !== location.origin) return nativeFetch(input, init);
    var path = unprefixed(url.pathname).replace(/\\/$/, '');
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (/^\\/cart\\/add(\\.js)?$/.test(path)) return addToCart(init);
    if (path === '/cart.js') return nativeFetch('/theme-actions/cart', { headers: { accept: 'application/json' } });
    if (/^\\/cart\\/(change|update|clear)(\\.js)?$/.test(path)) { location.href = prefix + '/cart'; return pending(); }
    if (/^\\/search\\/suggest/.test(path)) return nativeFetch(input, init);
    if (/^\\/recommendations\\/products/.test(path)) {
      // Our route answers; a failure (unknown product, no such section) reads as an empty row.
      var json = /\\.json$/.test(path) || !url.searchParams.get('section_id');
      return nativeFetch(input, init).then(function (res) {
        if (res.ok) return res;
        return json ? reply('{"intent":"related","products":[]}', 'application/json') : reply('', 'text/html');
      });
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
    // [onload]: a layout cached before the server started marking the link.
    document.querySelectorAll('link[rel="stylesheet"][media="print"][data-theme-promote], link[rel="stylesheet"][media="print"][onload]').forEach(function (link) {
      if (!link.hasAttribute('data-theme-promote') && !/this\\.media\\s*=\\s*'all'/.test(link.getAttribute('onload') || '')) return;
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
