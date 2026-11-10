import { CONSENT_COOKIE, CONSENT_MAX_AGE } from '@commerce/core/consent'
import { marketSuggestionContent } from '@/data/markets'
import { consentContent } from '@/data/online-store'
import type { ChatwootChat } from '../chatwoot'
import type { BrowserPixel } from '../pixels/track'
import { PRIVATE_PREFIXES } from '../tracking-paths'
import { fbqInit, gtmInit } from '../tracking-snippets'
import { islandModuleUrl } from './modules'

/**
 * The small scripts a plain HTML page needs (`lib/plain-html/render.ts`), in place of the React
 * runtime. One inline script with the request's CSP nonce, after the page's markup:
 *
 * - Theme boot: the theme's parked deferred and module scripts run once the page is parsed
 *   (`window.__commerceBootTheme`, `lib/liquid-shim.ts`). Nothing hydrates here, so there is
 *   nothing to wait for.
 * - Consent: the theme's own banner answers through the shim (`commerce:consent`). The choice
 *   goes into the `wc_consent` cookie at once and to `/theme-actions/consent` for the proof row,
 *   as `ConsentManager` does. The tags it allows load when the browser is idle.
 * - Analytics, after a yes: our visit beacon (`/api/beacon`), GA4 / Google Ads (gtag.js), Tag
 *   Manager, the Meta pixel, and the Umami app's tracker (cookieless: it may count before an
 *   answer when the store said so). A click on a product in a theme's recommendation row counts
 *   for Search & discovery (`DiscoveryTracker`).
 * - Pixels app, after a yes to marketing: its module (`pixels-module.ts`) loads when the browser
 *   is idle and sends PageView and every `commerce:track` event, as `PixelEvents` does.
 * - Inbox chat: the server draws the button (`chat-launcher.ts`); its module (`chat-module.ts`)
 *   loads on idle or on the first tap and opens the chat card in a frame.
 * - Our cookie banner, for a theme without its own, and the market suggestion: their modules
 *   (`banner-modules.ts`) draw the cards; the banner answers with the same `commerce:consent`
 *   event a theme's banner sends.
 * - Chatwoot app: its module (`chatwoot-module.ts`) once the store's chosen cookie category
 *   allows it, after the page has loaded.
 * - Experiments (GrowthBook): the experiments this page was drawn with, once, to
 *   `/api/experiments` (`ExperimentBeacon`). Only shoppers the server assigned have any.
 * - Page speed: LCP, INP and CLS to `/api/vitals`, anonymous, whatever the consent (as
 *   `WebVitalsBeacon`).
 *
 * The cart, predictive search, section rendering and recommendations need no island: the shim
 * already answers the theme's own calls (`/cart/add.js`, `/cart.js`, `?section_id=`).
 *
 * Island modules (`modules.ts`) load as separate files and register with
 * `window.__commerceIsland(name, fn)`; `fn` gets the module's config and the helpers `send`,
 * `inline`, `external` and `idle`.
 */
export type IslandConfig = {
  /** Settings › Customer privacy: answers for an older banner version do not count. */
  bannerVersion: number
  /** Validated tag ids from Preferences (empty when unset). */
  tracking: { ga4: string; gtm: string; metaPixel: string; googleAds: string }
  /** The Umami app's tracker, when installed and set up. */
  umami: { src: string; websiteId: string; waitForConsent: boolean } | null
  /** The Pixels app's pixels (they replace the legacy Meta pixel); null without the app. */
  pixels?: BrowserPixel[] | null | undefined
  /** Tracking keys of the experiments this page was drawn with. */
  experiments?: readonly string[] | undefined
  /** The Inbox chat's module, when the page drew its button (`chat-launcher.ts`). */
  chat?: { src: string; config: Record<string, unknown> } | null | undefined
  /** The Chatwoot app's chat, with the signed-in shopper's signed identity. */
  chatwoot?: ChatwootChat | null | undefined
  /** Our cookie banner, for a theme without its own: the store's wording (empty: ours). */
  consentBanner?: { message: string } | null | undefined
  /** Preferences › Markets › suggest the visitor's market, with more than one market live. */
  marketBanner?: boolean | undefined
}

/** The island script's body for `config`; `<` is escaped so no value can close the script. */
export function islandScript(config: IslandConfig): string {
  const t = config.tracking
  const data = {
    v: config.bannerVersion,
    cookie: CONSENT_COOKIE,
    maxAge: CONSENT_MAX_AGE,
    ga4: t.ga4 || null,
    ads: t.googleAds || null,
    gtm: t.gtm ? gtmInit(t.gtm) : null,
    // With the Pixels app installed its pixels replace the legacy one, as on the React page.
    meta: t.metaPixel && !config.pixels ? fbqInit([], t.metaPixel) : null,
    umami: config.umami,
    pixels: config.pixels?.length
      ? {
          src: islandModuleUrl('pixels'),
          config: {
            pixels: config.pixels,
            init: fbqInit(
              config.pixels.map((p) => p.id),
              null,
            ),
            private: PRIVATE_PREFIXES,
          },
        }
      : null,
    experiments: config.experiments?.length ? config.experiments : null,
    chat: config.chat ?? null,
    chatwoot: config.chatwoot
      ? {
          consent: config.chatwoot.widget.consent,
          src: islandModuleUrl('chatwoot'),
          config: {
            baseUrl: config.chatwoot.widget.baseUrl,
            websiteToken: config.chatwoot.widget.websiteToken,
            identity: config.chatwoot.identity,
          },
        }
      : null,
    consentBanner: config.consentBanner
      ? {
          src: islandModuleUrl('consent'),
          config: { copy: consentContent, message: config.consentBanner.message },
        }
      : null,
    market: config.marketBanner
      ? {
          src: islandModuleUrl('market'),
          config: {
            copy: {
              ...marketSuggestionContent,
              question: marketSuggestionContent.question('{country}'),
              body: marketSuggestionContent.body('{currency}'),
              switch: marketSuggestionContent.switch('{currency}'),
              stay: marketSuggestionContent.stay('{currency}'),
            },
          },
        }
      : null,
  }
  return ISLANDS.replace('__CONFIG__', JSON.stringify(data).replace(/</g, '\\u003c'))
}

const ISLANDS = `(function () {
  var c = __CONFIG__;
  var nonce = (document.currentScript && document.currentScript.nonce) || '';
  function boot() {
    setTimeout(function () {
      if (window.__commerceBootTheme) window.__commerceBootTheme().catch(function () {});
    }, 0);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  function readConsent() {
    var raw = (new RegExp('(?:^|;\\\\s*)' + c.cookie + '=([^;]*)').exec(document.cookie) || [])[1] || '';
    var p = /^a([01])m([01])(?:\\.v(\\d{1,6})\\.t(\\d{1,12}))?$/.exec(raw);
    if (!p || (p[3] ? Number(p[3]) : 0) < c.v) return null;
    return { analytics: p[1] === '1', marketing: p[2] === '1' };
  }
  function idle(fn) {
    var run = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 1); })(fn); };
    if (document.readyState === 'complete') run(); else window.addEventListener('load', run, { once: true });
  }
  function inline(code) {
    var s = document.createElement('script');
    if (nonce) s.nonce = nonce;
    s.textContent = code;
    document.head.appendChild(s);
  }
  function external(src, attrs) {
    var s = document.createElement('script');
    if (nonce) s.nonce = nonce;
    s.async = true;
    s.src = src;
    for (var k in attrs || {}) s.setAttribute(k, attrs[k]);
    document.head.appendChild(s);
  }
  function send(path, body) {
    var json = JSON.stringify(body);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(path, new Blob([json], { type: 'application/json' }))) return;
    } catch (e) {}
    fetch(path, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: json }).catch(function () {});
  }

  // Island modules: each file registers here and gets its config and these helpers.
  var modules = {};
  var api = { send: send, inline: inline, external: external, idle: idle, nonce: nonce };
  window.__commerceIsland = function (name, fn) {
    var m = modules[name];
    if (!m || m.started) return;
    m.started = true;
    try { fn(m.config, api); } catch (e) {}
  };
  function load(name, spec) {
    if (!spec || modules[name]) return;
    modules[name] = { config: spec.config, started: false };
    var s = document.createElement('script');
    if (nonce) s.nonce = nonce;
    s.type = 'module';
    s.src = spec.src;
    document.head.appendChild(s);
  }
  window.__commerceLoadIsland = load;

  // Search & discovery: a click on a product in a theme's recommendation row.
  var ROWS = '[data-recommendations], product-recommendations, .product-recommendations';
  function discoveryClick(event) {
    var a = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!a || a.origin !== location.origin) return;
    var m = /(?:^|\\/)products\\/([^/]+)\\/?$/.exec(a.pathname);
    var row = m && a.closest(ROWS);
    var now = readConsent();
    if (!row || !now || !now.analytics) return;
    var own = row.getAttribute('data-recommendations');
    var source = own === 'complementary' || own === 'related' ? own
      : row.getAttribute('data-intent') === 'complementary' || String(row.className).indexOf('complementary') >= 0 ? 'complementary' : 'related';
    var handle = m[1];
    try { handle = decodeURIComponent(handle); } catch (e) { return; }
    handle = handle.trim().toLowerCase();
    if (handle && handle.length <= 255) send('/api/beacon', { discovery: { kind: 'click', source: source, handle: handle } });
  }

  var done = {};
  function once(key, fn) { if (!done[key]) { done[key] = true; fn(); } }
  function gtag(id) {
    once('gtag:' + id, function () {
      if (!done.gtagjs) {
        done.gtagjs = true;
        external('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id));
        inline("window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());");
      }
      inline("gtag('config'," + JSON.stringify(id) + ");");
    });
  }
  function apply(consent) {
    if (c.umami && (consent ? consent.analytics : !c.umami.waitForConsent)) {
      once('umami', function () { external(c.umami.src, { 'data-website-id': c.umami.websiteId }); });
    }
    // Chatwoot waits for the category its store picked; necessary loads it for everyone.
    if (c.chatwoot && (c.chatwoot.consent === 'necessary' || (consent && consent[c.chatwoot.consent] === true))) {
      idle(function () { load('chatwoot', c.chatwoot); });
    }
    // No yes yet: the server counts the visit without cookies (totals only); a later yes sends the full one.
    if (!(consent && consent.analytics)) {
      once('anon-visit', function () { send('/api/beacon', { href: location.href, referrer: document.referrer }); });
    }
    if (!consent) return;
    if (consent.analytics) {
      once('visit', function () {
        send('/api/beacon', { href: location.href, referrer: document.referrer });
        document.addEventListener('click', discoveryClick, { capture: true, passive: true });
      });
      idle(function () {
        if (c.ga4) gtag(c.ga4);
        if (c.gtm) once('gtm', function () { inline(c.gtm); });
      });
    }
    if (consent.marketing) {
      idle(function () {
        if (c.ads) gtag(c.ads);
        if (c.meta) once('meta', function () { inline(c.meta); });
        load('pixels', c.pixels);
      });
    }
  }

  // Our cookie banner (a theme without its own): at once while unanswered, or from Cookie settings.
  if (c.consentBanner) {
    if (readConsent() === null) { c.consentBanner.config.ask = true; load('consent', c.consentBanner); }
    var reopen = function () {
      if (location.hash !== '#cookie-settings' || modules.consent) return;
      history.replaceState(null, '', location.pathname + location.search);
      c.consentBanner.config.reopen = true;
      load('consent', c.consentBanner);
    };
    reopen();
    window.addEventListener('hashchange', reopen);
  }
  // "Shop in AED?": asked for once the page has loaded.
  if (c.market) idle(function () { load('market', c.market); });

  // The Inbox chat: its module on idle, or at once (opening the chat) on a tap before that.
  var chatButton = c.chat && document.getElementById('wc-chat');
  if (chatButton) {
    chatButton.addEventListener('click', function () {
      var m = modules.chat;
      if (!m) { c.chat.config.openNow = true; load('chat', c.chat); } else if (!m.started) m.config.openNow = true;
    }, { once: true });
    idle(function () { load('chat', c.chat); });
  }

  // "Experiment viewed": the server only assigns shoppers who said yes to analytics.
  if (c.experiments) send('/api/experiments', { seen: c.experiments });

  var current = readConsent();
  if (current === null) {
    try {
      if (!sessionStorage.getItem('wc_banner_shown')) {
        sessionStorage.setItem('wc_banner_shown', '1');
        navigator.sendBeacon('/api/consent-shown');
      }
    } catch (e) {}
  }
  apply(current);
  window.addEventListener('commerce:consent', function (event) {
    var d = (event && event.detail) || {};
    var next = { analytics: d.analytics === true, marketing: d.marketing === true };
    var secure = location.protocol === 'https:' ? '; secure' : '';
    document.cookie = c.cookie + '=a' + (next.analytics ? 1 : 0) + 'm' + (next.marketing ? 1 : 0) + '.v' + c.v + '.t' + Math.floor(Date.now() / 1000) + '; path=/; max-age=' + c.maxAge + '; samesite=lax' + secure;
    fetch('/theme-actions/consent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) }).catch(function () {});
    apply(next);
  });

  // Page speed: Google's three Core Web Vitals, sent once as the page is left.
  if (window.top === window.self && !/[?&]theme-preview=/.test(location.search) && window.PerformanceObserver) {
    var vitals = {};
    var cls = 0;
    var observe = function (type, fn) {
      try { new PerformanceObserver(function (list) { list.getEntries().forEach(fn); }).observe({ type: type, buffered: true }); } catch (e) {}
    };
    observe('largest-contentful-paint', function (e) { vitals.LCP = e.startTime; });
    observe('layout-shift', function (e) { if (!e.hadRecentInput) { cls += e.value; vitals.CLS = cls; } });
    observe('event', function (e) { if (e.interactionId && (!vitals.INP || e.duration > vitals.INP)) vitals.INP = e.duration; });
    var sent = false;
    var flush = function (force) {
      if (sent || (force !== true && document.visibilityState !== 'hidden')) return;
      var readings = Object.keys(vitals).map(function (k) { return { metric: k, value: vitals[k] }; });
      if (!readings.length) return;
      sent = true;
      send('/api/vitals', { path: location.pathname, device: window.innerWidth < 768 ? 'mobile' : 'desktop', readings: readings });
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', function () { flush(true); });
  }
})();`
