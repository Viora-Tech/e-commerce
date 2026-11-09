/**
 * The Inbox chat on a plain HTML page (`modules.ts`): what `InboxLauncher` does on the React page,
 * as plain JS, around the button the server drew (`chat-launcher.ts`). Loaded when the browser is
 * idle, or by the first tap.
 *
 * - Keeps the button clear of a theme's bars pinned to the bottom of the window (a mobile dock, a
 *   sticky add-to-cart, a cookie banner) and hides it under an open theme overlay (a cart
 *   drawer): the same rules as `lib/launcher-lift.ts`, kept in step by `chat-module.test.ts`.
 * - The first tap opens the chat card in a same-origin frame (`lib/inbox-frame.ts`), placed and
 *   sized as `ChatWidget` places its card; the button turns into a chevron that closes it. The
 *   frame tells the page when the shopper closes it, docks or expands it, or has unread replies.
 * - A browser that has chatted before loads the frame hidden after a short wait, so replies show
 *   on the button's badge.
 *
 * Config: `chatModuleSpec` in `chat-launcher.ts`, plus `openNow` when a tap loaded the module.
 */
export const CHAT_MODULE = `window.__commerceIsland && window.__commerceIsland('chat', function (c, api) {
  var button = document.getElementById('wc-chat');
  if (!button) return;
  var badge = button.querySelector('.wc-chat-badge');
  var frame = null;
  var ready = false;
  var open = false;
  var queued = [];
  var lift = -1;

  function isOverlay(box, vh) { return box.bottom - box.top > vh * c.share; }
  function launcherLift(bars, launcher, vh) {
    var most = 0;
    bars.forEach(function (bar) {
      var pinned = bar.bottom >= vh - c.edge;
      var overlaps = bar.left < launcher.right && bar.right > launcher.left;
      if (pinned && !isOverlay(bar, vh) && overlaps) most = Math.max(most, vh - bar.top);
    });
    return Math.max(0, Math.round(most));
  }
  function ours(el) { return el.closest('[' + c.root + ']'); }
  function pinnedAncestor(el) {
    for (var at = el; at && at !== document.body && at !== document.documentElement; at = at.parentElement) {
      var position = getComputedStyle(at).position;
      if (position === 'fixed' || position === 'sticky') return at;
    }
    return null;
  }
  function bottomBars(launcher) {
    var found = [];
    var y = window.innerHeight - 2;
    var inset = Math.min(8, (launcher.right - launcher.left) / 4);
    [launcher.left + inset, (launcher.left + launcher.right) / 2, launcher.right - inset].forEach(function (x) {
      document.elementsFromPoint(x, y).forEach(function (el) {
        if (ours(el)) return;
        var bar = pinnedAncestor(el);
        if (bar && !ours(bar) && found.indexOf(bar) < 0) found.push(bar);
      });
    });
    return found.map(function (el) { return el.getBoundingClientRect(); });
  }
  function overlayOver(launcher) {
    var x = (launcher.left + launcher.right) / 2;
    var y = (launcher.top + launcher.bottom) / 2;
    var under = document.elementsFromPoint(x, y).filter(function (el) { return !ours(el); })[0];
    var layer = pinnedAncestor(under || null);
    return layer !== null && isOverlay(layer.getBoundingClientRect(), window.innerHeight);
  }

  var frameId = 0;
  function measure() {
    cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(function () {
      var box = button.getBoundingClientRect();
      // Hidden (the phone's full-screen chat is open): keep the last answer.
      if (!box.width) return;
      var next = launcherLift(bottomBars(box), box, window.innerHeight);
      if (next !== lift) {
        lift = next;
        document.documentElement.style.setProperty('--wc-chat-bottom', next > 0 ? 'max(' + c.base + ', ' + next + 'px + ' + c.gap + ')' : '(' + c.base + ')');
      }
      button.classList.toggle('is-covered', overlayOver(box));
    });
  }
  measure();
  setTimeout(measure, 1500);
  new MutationObserver(measure).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'open', 'hidden'] });
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);

  function post(message) {
    if (!frame) return;
    if (!ready) { queued.push(message); return; }
    frame.contentWindow.postMessage(message, location.origin);
  }
  function ensureFrame(openNow) {
    if (frame) return;
    frame = document.createElement('iframe');
    frame.id = 'wc-chat-frame';
    frame.setAttribute(c.root, '');
    frame.setAttribute('title', c.title);
    frame.setAttribute('allow', 'clipboard-write');
    frame.dataset.mode = 'float';
    frame.src = c.frame + (openNow ? '#open' : '');
    document.body.appendChild(frame);
  }
  function setOpen(next, tell) {
    open = next;
    button.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? c.close : c.open);
    if (frame) frame.classList.toggle('is-open', open);
    if (tell) post({ wcChat: open ? 'open' : 'close' });
    if (open) { if (frame) frame.focus(); } else button.focus({ preventScroll: true });
  }

  window.addEventListener('message', function (event) {
    if (!frame || event.source !== frame.contentWindow || event.origin !== location.origin) return;
    var d = event.data || {};
    if (d.wcChat === 'ready') {
      ready = true;
      queued.splice(0).forEach(post);
    } else if (d.wcChat === 'close') {
      setOpen(false, false);
    } else if (d.wcChat === 'unread') {
      var n = Math.max(0, Math.floor(Number(d.n) || 0));
      badge.hidden = n === 0;
      badge.textContent = n ? String(n) : '';
    } else if (d.wcChat === 'mode' && /^(float|docked|expanded)$/.test(d.mode)) {
      frame.dataset.mode = d.mode;
    }
  });
  window.addEventListener('keydown', function (event) {
    if (open && event.key === 'Escape') setOpen(false, true);
  });
  button.addEventListener('click', function () {
    if (!frame) { ensureFrame(true); setOpen(true, false); return; }
    setOpen(!open, true);
  });

  if (c.openNow) {
    ensureFrame(true);
    setOpen(true, false);
  } else {
    try {
      if (localStorage.getItem(c.activeKey) === '1') setTimeout(function () { ensureFrame(false); }, 2500);
    } catch (e) {}
  }
});
`
