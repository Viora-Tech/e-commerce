/**
 * SOURCE OF TRUTH: a hero video's cover as its fallback — WHAT: a background video whose cover
 * the storefront moved to `data-cover` (`liquid-video-cover.ts`) gets that cover back as its
 * `poster` when it cannot play: the file fails to load, or it has not started 3 s after the page
 * is ready (autoplay blocked by a phone's data saver or low-power mode, a slow network).
 * WHY: owner, 21 Nov 2026: a slide whose video does not load stayed a black box on phones; the
 * picture must show then. A video that plays never shows its cover (owner, 17 Nov 2026).
 * WHERE: appended to the theme shim (`liquid-shim.ts`), so it runs on every Liquid page.
 */

/** How long a background video may take to start before its cover shows. */
export const COVER_FALLBACK_MS = 3000

export const VIDEO_FALLBACK_SCRIPT = `(function () {
  if (window.__commerceVideoFallback || !window.document) return;
  window.__commerceVideoFallback = true;
  var doc = window.document;
  function watch(v) {
    if (v.__coverWatch) return;
    v.__coverWatch = true;
    var cover = v.getAttribute('data-cover');
    if (!cover) return;
    function show() { if (!v.getAttribute('poster')) v.setAttribute('poster', cover); }
    v.addEventListener('error', show);
    var sources = v.querySelectorAll('source');
    if (sources.length) sources[sources.length - 1].addEventListener('error', show);
    setTimeout(function () {
      if (v.error || v.paused || v.readyState < 2) show();
    }, ${COVER_FALLBACK_MS});
  }
  function scan() {
    Array.prototype.forEach.call(doc.querySelectorAll('video[data-cover]'), watch);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', scan);
  else scan();
  window.addEventListener('load', scan);
})();`
