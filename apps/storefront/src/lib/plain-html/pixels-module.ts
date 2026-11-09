/**
 * The Pixels app on a plain HTML page (`modules.ts`): the same work as `PixelEvents` and
 * `lib/pixels/track.ts` on the React page, as plain JS. Loaded by the inline island only after a
 * yes to marketing. Starts fbevents.js with every pixel, sends a PageView, then every
 * `commerce:track` event (and any reported before it loaded), each twice with one event id: to the
 * browser pixels that have the event on (`fbq('trackSingle', …, { eventID })`) and to `/api/px`.
 *
 * Config: `{ pixels: [{ id, events, browserPurchase }], init, private }` where `init` is the
 * fbevents.js loader with each pixel's `init` (`fbqInit`) and `private` the paths nothing is sent
 * from (`lib/tracking-paths.ts`). Kept in step with `track.ts` by `pixels-module.test.ts`.
 */
export const PIXELS_MODULE = `window.__commerceIsland && window.__commerceIsland('pixels', function (c, api) {
  var EVENTS = ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase'];
  var ADD_COUNT_KEY = 'wc_px_atc';
  api.inline(c.init);

  function allowed() {
    var p = location.pathname;
    return !c.private.some(function (x) { return p === x || p.indexOf(x + '/') === 0; });
  }
  function nextAddCount(variantId) {
    try {
      var counts = JSON.parse(sessionStorage.getItem(ADD_COUNT_KEY) || '{}');
      var n = ((counts[variantId] || 0) % 9999) + 1;
      counts[variantId] = n;
      sessionStorage.setItem(ADD_COUNT_KEY, JSON.stringify(counts));
      return n;
    } catch (e) {
      return Math.floor(Math.random() * 9999) + 1;
    }
  }
  function eventId(d) {
    if (d.eventId) return d.eventId;
    if (d.name === 'AddToCart' && d.variantId) return 'atc_' + d.variantId + '_' + nextAddCount(d.variantId);
    return crypto.randomUUID();
  }
  function data(d) {
    var o = {};
    if (typeof d.valuePaise === 'number') { o.value = Math.round(d.valuePaise) / 100; o.currency = 'INR'; }
    var ids = d.contentIds || (d.variantId ? [d.variantId] : []);
    if (ids.length) { o.content_ids = ids; o.content_type = 'product'; }
    if (typeof d.numItems === 'number') o.num_items = d.numItems;
    return o;
  }
  function match(m) {
    var email = m && m.email ? m.email.trim().toLowerCase() : '';
    var digits = m && m.phone ? m.phone.replace(/[^0-9]/g, '') : '';
    var phone = digits.length === 10 ? '91' + digits : digits;
    var o = {};
    if (email.indexOf('@') >= 0) o.em = email;
    if (phone.length >= 11) o.ph = phone;
    return Object.keys(o).length ? o : null;
  }
  function send(d) {
    d.handled = true;
    if (EVENTS.indexOf(d.name) < 0 || !allowed()) return;
    var id = eventId(d);
    var custom = data(d);
    var m = match(d.match);
    c.pixels.forEach(function (p) {
      if (p.events.indexOf(d.name) < 0) return;
      if (d.name === 'Purchase' && !p.browserPurchase) return;
      if (m) window.fbq('init', p.id, m);
      window.fbq('trackSingle', p.id, d.name, custom, { eventID: id });
    });
    var body = { name: d.name, eventId: id, url: location.href, productId: d.productId, variantId: d.variantId };
    if (d.name === 'AddToCart' && typeof d.numItems === 'number') body.quantity = d.numItems;
    api.send('/api/px', body);
  }
  (window.__commerceTrack || []).forEach(function (d) { if (!d.handled) send(d); });
  window.addEventListener('commerce:track', function (e) { if (e && e.detail) send(e.detail); });
  send({ name: 'PageView' });
});
`
