import { CONSENT_COOKIE, CONSENT_MAX_AGE } from '@commerce/core/consent'
import { fbqInit, gtmInit } from '../tracking-snippets'

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
 *   answer when the store said so).
 * - Page speed: LCP, INP and CLS to `/api/vitals`, anonymous, whatever the consent (as
 *   `WebVitalsBeacon`).
 *
 * The cart, predictive search, section rendering and recommendations need no island: the shim
 * already answers the theme's own calls (`/cart/add.js`, `/cart.js`, `?section_id=`).
 */
export type IslandConfig = {
  /** Settings › Customer privacy: answers for an older banner version do not count. */
  bannerVersion: number
  /** Validated tag ids from Preferences (empty when unset). */
  tracking: { ga4: string; gtm: string; metaPixel: string; googleAds: string }
  /** The Umami app's tracker, when installed and set up. */
  umami: { src: string; websiteId: string; waitForConsent: boolean } | null
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
    meta: t.metaPixel ? fbqInit([], t.metaPixel) : null,
    umami: config.umami,
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
    if (!consent) return;
    if (consent.analytics) {
      once('visit', function () { send('/api/beacon', { href: location.href, referrer: document.referrer }); });
      idle(function () {
        if (c.ga4) gtag(c.ga4);
        if (c.gtm) once('gtm', function () { inline(c.gtm); });
      });
    }
    if (consent.marketing) {
      idle(function () {
        if (c.ads) gtag(c.ads);
        if (c.meta) once('meta', function () { inline(c.meta); });
      });
    }
  }

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
