import type { InboxWidget } from '@commerce/core/inbox'
import { CHAT_ICON_PATHS } from '@/components/inbox/chat-icon'
import { inboxChatContent as copy } from '@/data/inbox'
import { CHAT_ACTIVE_KEY, CHAT_FRAME_PATH } from '../inbox-frame'
import { chatFontFamily } from '../inbox-guard'
import { CHAT_ROOT_ATTR, EDGE_PX, LAUNCHER_BOTTOM, LIFT_GAP, MAX_BAR_SHARE } from '../launcher-lift'
import { islandModuleUrl } from './modules'

/**
 * The Inbox chat button on a plain HTML page, drawn by the server with the page so it shows at
 * once, in the same place, size and colours as `InboxLauncher` on the React page. Its module
 * (`chat-module.ts`) loads when the browser is idle (or on the first tap); the chat card itself
 * opens in a frame (`lib/inbox-frame.ts`), so React loads only when a shopper asks to chat.
 *
 * The page has no Tailwind (it carries only the theme's CSS), so the button's look is a small
 * scoped stylesheet with `!important`, which also keeps the theme's `button` and `svg` rules out.
 */

const escapeHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** `ChatIcon` as a string: the same paths, stroked in `currentColor`. */
const icon = (kind: keyof typeof CHAT_ICON_PATHS, cls: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${cls}">${CHAT_ICON_PATHS[kind].map((d) => `<path d="${d}"></path>`).join('')}</svg>`

/** The button's base height above the safe area, before any lift over a theme's bottom bar. */
const baseBottom = (w: InboxWidget) =>
  `${LAUNCHER_BOTTOM[w.vertical]} + env(safe-area-inset-bottom)`

/** The scoped CSS for the button and the frame; `#wc-chat` keeps it off the theme's elements. */
function css(w: InboxWidget): string {
  const bg = w.background || 'var(--btn-bg, var(--color-ink, CanvasText))'
  const fg = w.textColour || 'var(--btn-text, var(--color-bg, Canvas))'
  const [fill, ink] = w.invertActivator
    ? [
        w.textColour || 'var(--color-bg, Canvas)',
        w.background || 'var(--btn-bg, var(--color-ink, CanvasText))',
      ]
    : [bg, fg]
  const side =
    w.horizontal === 'left'
      ? 'left:1rem!important;'
      : w.horizontal === 'center'
        ? 'left:50%!important;transform:translateX(-50%)!important;'
        : 'right:1rem!important;'
  const frameSide =
    w.horizontal === 'left'
      ? 'left:1rem;'
      : w.horizontal === 'center'
        ? 'left:50%;translate:-50% 0;'
        : 'right:1rem;'
  const dockSide = w.horizontal === 'left' ? 'left:0;' : 'right:0;'
  const bottom = `calc(var(--wc-chat-bottom, ${baseBottom(w)}))`
  const radius = `${w.borderRadius / 16}rem`
  return [
    `#wc-chat{all:initial;position:fixed!important;z-index:999!important;bottom:${bottom}!important;${side}display:flex!important;align-items:center!important;justify-content:center!important;gap:0.5rem!important;box-sizing:border-box!important;height:3.5rem!important;min-width:3.5rem!important;padding:0 ${w.activatorLabel || w.activatorIcon === 'none' ? '1.25rem' : '0'}!important;margin:0!important;border:0!important;border-radius:9999px!important;background:${fill}!important;color:${ink}!important;font-family:${chatFontFamily(w.inheritFont)}!important;font-size:${w.activatorFontSize / 16}rem!important;font-weight:500!important;line-height:1!important;letter-spacing:normal!important;text-transform:none!important;cursor:pointer!important;touch-action:manipulation!important;box-shadow:0 0 0 1px rgb(0 0 0/0.06),0 8px 24px rgb(0 0 0/0.16)!important;transition:scale 160ms ease-out,opacity 160ms ease-out!important;-webkit-tap-highlight-color:transparent}`,
    '#wc-chat:active{scale:0.96}',
    '#wc-chat:focus-visible{outline:2px solid currentColor!important;outline-offset:3px!important}',
    '#wc-chat svg{display:block!important;width:1.5rem!important;height:1.5rem!important;margin:0!important;fill:none!important;stroke:currentColor!important;flex:none!important;transition:opacity 200ms ease-out,rotate 200ms ease-out,scale 200ms ease-out!important}',
    '#wc-chat .wc-chat-label svg{width:1.25rem!important;height:1.25rem!important}',
    '#wc-chat .wc-chat-icons{position:relative!important;display:grid!important;width:1.5rem!important;height:1.5rem!important;place-items:center!important}',
    '#wc-chat .wc-chat-icons svg{position:absolute!important;inset:0!important}',
    '#wc-chat .wc-chat-chevron{opacity:0!important}',
    '#wc-chat.is-open .wc-chat-chevron{opacity:1!important}',
    '#wc-chat.is-open .wc-chat-main{opacity:0!important}',
    '#wc-chat.is-open .wc-chat-label{display:none!important}',
    '#wc-chat.is-open:has(.wc-chat-label){padding:0!important;width:3.5rem!important}',
    '#wc-chat .wc-chat-icons-open{display:none!important}',
    '#wc-chat.is-open .wc-chat-icons-open{display:grid!important}',
    '@media (prefers-reduced-motion:no-preference){#wc-chat.is-open .wc-chat-main{rotate:-20deg;scale:0.9}#wc-chat:not(.is-open) .wc-chat-chevron{rotate:20deg;scale:0.9}}',
    '#wc-chat.is-covered:not(.is-open){visibility:hidden!important;opacity:0!important}',
    `#wc-chat .wc-chat-badge{position:absolute!important;top:-0.25rem!important;right:-0.25rem!important;display:flex!important;align-items:center!important;justify-content:center!important;height:1.25rem!important;min-width:1.25rem!important;padding:0 0.375rem!important;box-sizing:border-box!important;border-radius:9999px!important;background:var(--color-bg,Canvas)!important;color:var(--color-ink,CanvasText)!important;font-size:0.6875rem!important;font-weight:600!important;font-variant-numeric:tabular-nums!important;box-shadow:0 0 0 1px rgb(0 0 0/0.08)!important}`,
    '#wc-chat .wc-chat-badge[hidden],#wc-chat.is-open .wc-chat-badge{display:none!important}',
    // The card's frame: as `ChatWidget` places its card (float above the button, docked to a side,
    // full screen), and full screen on a phone.
    `#wc-chat-frame{position:fixed!important;z-index:2147483000!important;border:0!important;margin:0!important;padding:0!important;max-width:none!important;background:transparent!important;color-scheme:normal;inset:0;width:100%;height:100%;opacity:1;visibility:visible;transition:opacity 220ms ease-out,translate 220ms ease-out,scale 220ms ease-out,visibility 220ms}`,
    '#wc-chat-frame:not(.is-open){opacity:0;visibility:hidden;pointer-events:none;transition-duration:160ms}',
    '@media (prefers-reduced-motion:no-preference){#wc-chat-frame:not(.is-open){translate:0 100%}}',
    `@media (min-width:40rem){#wc-chat-frame[data-mode="float"]{inset:auto;bottom:calc(${bottom} + 4.25rem);${frameSide}width:25rem;height:min(41rem,calc(100dvh - ${bottom} - 4.25rem - 1rem));border-radius:${radius}!important;box-shadow:0 0 0 1px rgb(0 0 0/0.06),0 12px 32px rgb(0 0 0/0.12),0 2px 6px rgb(0 0 0/0.06)!important}`,
    `#wc-chat-frame[data-mode="docked"]{inset:0 auto;${dockSide}width:26rem;height:100%}}`,
    '@media (min-width:40rem) and (prefers-reduced-motion:no-preference){#wc-chat-frame[data-mode="float"]:not(.is-open){translate:0 0.5rem;scale:0.96}}',
    '@media (max-width:39.99rem){#wc-chat.is-open{display:none!important}}',
  ].join('')
}

/** The button's markup and scoped CSS, for the end of `<body>`. */
export function chatLauncherHtml(w: InboxWidget): string {
  const label = w.activatorLabel || (w.activatorIcon === 'none' ? copy.launcher : '')
  const glyph = w.activatorIcon === 'none' ? '' : icon(w.activatorIcon, 'wc-chat-main')
  const inner = label
    ? `<span class="wc-chat-label" style="display:contents">${glyph}<span>${escapeHtml(label)}</span></span><span class="wc-chat-icons wc-chat-icons-open">${icon('chevronDown', 'wc-chat-chevron')}</span>`
    : `<span class="wc-chat-icons">${glyph}${icon('chevronDown', 'wc-chat-chevron')}</span>`
  return `<style>${css(w)}</style><button type="button" id="wc-chat" ${CHAT_ROOT_ATTR} aria-label="${escapeHtml(copy.open)}" aria-expanded="false">${inner}<span class="wc-chat-badge" hidden></span></button>`
}

/** The chat module's config (`chat-module.ts`). */
export function chatModuleSpec(w: InboxWidget, storeName: string) {
  return {
    src: islandModuleUrl('chat'),
    config: {
      frame: CHAT_FRAME_PATH,
      activeKey: CHAT_ACTIVE_KEY,
      title: copy.title(storeName),
      open: copy.open,
      close: copy.close,
      base: baseBottom(w),
      gap: LIFT_GAP,
      edge: EDGE_PX,
      share: MAX_BAR_SHARE,
      root: CHAT_ROOT_ATTR,
    },
  }
}
