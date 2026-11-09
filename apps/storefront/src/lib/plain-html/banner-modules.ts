/**
 * Our own banners on a plain HTML page (`modules.ts`), as plain JS, each drawing its card itself
 * with a small scoped stylesheet (the page carries only the theme's CSS, no Tailwind):
 *
 * - `consent`: our cookie banner, for a theme without its own (`CookieBanner` on the React page).
 *   Equal weight for "Necessary only" and "Accept all", and a category list where every optional
 *   box starts unticked (ticked as chosen when reopened from Cookie settings, `#cookie-settings`).
 *   The answer goes out as the same `commerce:consent` event a theme's own banner sends, so the
 *   inline island stores it, records the proof and loads what it allows.
 *   Config: `{ copy, message, ask, reopen }`: `ask` when the shopper has no answer for this
 *   banner version yet, `reopen` when Cookie settings opened it.
 * - `market`: "Shopping from the UAE? Shop in AED" (`MarketSuggestion`): asked for after the page
 *   loads (`/theme-actions/market-suggestion`), so cached pages stay the same for everyone; "Shop
 *   in" posts the country selector's form, "Stay" saves the market shown. Config: `{ copy }`.
 */

const CARD =
  'all:initial;box-sizing:border-box;display:flex;flex-direction:column;gap:1rem;width:100%;max-height:min(80dvh,36rem);overflow-y:auto;overscroll-behavior:contain;padding:1rem;border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:0.5rem;background:var(--color-surface,Canvas);color:var(--color-ink,CanvasText);font:inherit;font-size:0.875rem;line-height:1.45;box-shadow:0 10px 30px rgb(0 0 0/0.14);overflow-wrap:anywhere;pointer-events:auto;color-scheme:inherit'

/** Shared look for both cards: `#wc-…` scopes it away from the theme. */
const css = (id: string, edge: string) =>
  [
    `#${id}{position:fixed;z-index:50;left:0.75rem;right:0.75rem;${edge};display:flex;justify-content:center;pointer-events:none;font-family:inherit}`,
    `#${id} section{${CARD}}`,
    `#${id} *{box-sizing:border-box;margin:0;font:inherit;letter-spacing:normal;text-transform:none}`,
    `#${id} .wc-h{font-size:1rem;font-weight:600}`,
    `#${id} .wc-m{opacity:0.72}`,
    `#${id} .wc-row{display:flex;flex-wrap:wrap;gap:0.5rem}`,
    `#${id} button{all:unset;box-sizing:border-box;flex:1 1 8rem;min-width:fit-content;min-height:2.5rem;padding:0.5rem 1rem;border-radius:0.375rem;border:1px solid currentColor;text-align:center;white-space:nowrap;font-weight:600;cursor:pointer;touch-action:manipulation;transition:scale 160ms ease-out,opacity 160ms ease-out}`,
    `#${id} button:active{scale:0.97}`,
    `#${id} button:focus-visible{outline:2px solid currentColor;outline-offset:2px}`,
    `#${id} .wc-primary{background:var(--color-ink,CanvasText);color:var(--color-surface,Canvas);border-color:transparent}`,
    `#${id} .wc-x{flex:none;min-height:0;min-width:0;padding:0.25rem;border:0;opacity:0.72;line-height:0}`,
    `#${id} ul{list-style:none;padding:0;display:flex;flex-direction:column;gap:0.75rem}`,
    `#${id} li{display:flex;align-items:flex-start;gap:0.75rem}`,
    `#${id} input{margin-top:0.25rem;flex:none;accent-color:currentColor}`,
    `#${id} label,#${id} .wc-cat{display:flex;flex-direction:column;min-width:0}`,
    `#${id} .wc-cat b,#${id} label b{font-weight:600}`,
    `@media (min-width:40rem){#${id}{left:auto;right:auto;justify-content:flex-start}#${id} section{width:var(--wc-w);padding:1.25rem}}`,
  ].join('')

export const CONSENT_BANNER_MODULE = `window.__commerceIsland && window.__commerceIsland('consent', function (c) {
  var t = c.copy;
  var style = document.createElement('style');
  style.textContent = ${JSON.stringify(css('wc-consent', 'bottom:max(0.75rem,env(safe-area-inset-bottom))'))} + '@media (min-width:40rem){#wc-consent{left:1.25rem;bottom:1.25rem}}#wc-consent{--wc-w:24rem}';
  document.head.appendChild(style);
  var root = null;
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (kid) { if (kid) e.appendChild(kid); });
    return e;
  }
  function current() {
    var m = /(?:^|;\\s*)wc_consent=a([01])m([01])/.exec(document.cookie);
    return m ? { analytics: m[1] === '1', marketing: m[2] === '1' } : { analytics: false, marketing: false };
  }
  function choose(next) {
    window.dispatchEvent(new CustomEvent('commerce:consent', { detail: next }));
    close();
  }
  function close() { if (root) { root.remove(); root = null; } }
  function show(choosing) {
    close();
    var draft = choosing ? current() : { analytics: false, marketing: false };
    var section = el('section', { 'aria-label': t.label });
    section.appendChild(el('div', {}, [el('p', { class: 'wc-h', text: t.heading }), el('p', { class: 'wc-m', text: c.message || t.body })]));
    if (choosing) {
      var list = el('ul');
      var nec = el('input', { type: 'checkbox', checked: '', disabled: '', 'aria-labelledby': 'wc-c-necessary' });
      list.appendChild(el('li', {}, [nec, el('span', { class: 'wc-cat' }, [el('b', { id: 'wc-c-necessary', text: t.categories.necessary.label }), el('span', { class: 'wc-m', text: t.categories.necessary.body })])]));
      ['analytics', 'marketing'].forEach(function (key) {
        var box = el('input', { type: 'checkbox', id: 'wc-c-' + key });
        box.checked = draft[key];
        box.addEventListener('change', function () { draft[key] = box.checked; });
        list.appendChild(el('li', {}, [box, el('label', { for: 'wc-c-' + key }, [el('b', { text: t.categories[key].label }), el('span', { class: 'wc-m', text: t.categories[key].body })])]));
      });
      section.appendChild(list);
    }
    var first = el('button', { type: 'button', text: choosing ? t.save : t.customise });
    first.addEventListener('click', function () { if (choosing) choose(draft); else show(true); });
    var reject = el('button', { type: 'button', text: t.rejectAll });
    reject.addEventListener('click', function () { choose({ analytics: false, marketing: false }); });
    var accept = el('button', { type: 'button', class: 'wc-primary', text: t.acceptAll });
    accept.addEventListener('click', function () { choose({ analytics: true, marketing: true }); });
    section.appendChild(el('div', { class: 'wc-row' }, [first, reject, accept]));
    root = el('div', { id: 'wc-consent' }, [section]);
    document.body.appendChild(root);
  }
  function fromHash() {
    if (location.hash !== '#cookie-settings') return false;
    history.replaceState(null, '', location.pathname + location.search);
    show(true);
    return true;
  }
  window.addEventListener('hashchange', fromHash);
  if (!fromHash()) {
    if (c.reopen) show(true);
    else if (c.ask) show(false);
  }
});
`

export const MARKET_BANNER_MODULE = `window.__commerceIsland && window.__commerceIsland('market', function (c) {
  if (window.self !== window.top) return;
  var t = c.copy;
  var query = new URLSearchParams({ path: location.pathname });
  var fake = new URLSearchParams(location.search).get('visitor_country');
  if (fake) query.set('country', fake);
  fetch('/theme-actions/market-suggestion?' + query, { headers: { accept: 'application/json' }, cache: 'no-store' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (body) { if (body && body.suggestion) show(body.suggestion); })
    .catch(function () {});
  function here() { return location.pathname + location.search; }
  function name(code) {
    try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code; } catch (e) { return code; }
  }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (kid) { if (kid) e.appendChild(kid); });
    return e;
  }
  function hidden(n, v) { return el('input', { type: 'hidden', name: n, value: v }); }
  function show(s) {
    var style = document.createElement('style');
    style.textContent = ${JSON.stringify(css('wc-market', 'top:max(0.75rem,env(safe-area-inset-top))'))} + '@media (min-width:40rem){#wc-market{right:1.25rem;justify-content:flex-end}}#wc-market{--wc-w:22rem}';
    document.head.appendChild(style);
    var root;
    var stay = function () {
      root.remove();
      var body = new FormData();
      body.set('country_code', s.current.country);
      body.set('language_code', s.current.language);
      body.set('return_to', here());
      fetch('/theme-actions/localization', { method: 'POST', body: body, redirect: 'manual', keepalive: true }).catch(function () {});
    };
    var x = el('button', { type: 'button', class: 'wc-x', 'aria-label': t.close });
    x.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    x.addEventListener('click', stay);
    var stayButton = el('button', { type: 'button', text: t.stay.replace('{currency}', s.current.currency) });
    stayButton.addEventListener('click', stay);
    var form = el('form', { method: 'post', action: '/theme-actions/localization', class: 'wc-row' }, [
      hidden('country_code', s.country), hidden('language_code', ''), hidden('return_to', '/'),
      stayButton, el('button', { type: 'submit', class: 'wc-primary', text: t.switch.replace('{currency}', s.currency) }),
    ]);
    form.addEventListener('submit', function () { form.elements.namedItem('return_to').value = here(); });
    var head = el('div', { class: 'wc-row', style: 'flex-wrap:nowrap;align-items:flex-start;gap:0.75rem' }, [
      el('div', { style: 'display:flex;flex-direction:column;gap:0.25rem;flex:1 1 auto;min-width:0' }, [
        el('p', { class: 'wc-h', text: t.question.replace('{country}', name(s.country)) }),
        el('p', { class: 'wc-m', text: t.body.replace('{currency}', s.currency) }),
      ]),
      x,
    ]);
    root = el('div', { id: 'wc-market' }, [el('section', { 'aria-label': t.label, style: 'gap:0.75rem' }, [head, form])]);
    var header = document.querySelector('sticky-header, .header-wrapper, .shopify-section-header, header');
    var place = function () {
      var bottom = header ? header.getBoundingClientRect().bottom : 0;
      root.style.top = Math.max(12, Math.round(bottom) + 12) + 'px';
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
    document.body.appendChild(root);
  }
});
`
