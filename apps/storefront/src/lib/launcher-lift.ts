/**
 * Keeps the Inbox chat button clear of a theme's bars pinned to the bottom of the window: a
 * mobile dock (Search / Shop / Cart), a sticky add-to-cart, a cookie banner. Any theme can have
 * one, ours included (the Zero Drift dock is `position: fixed` at z-index 45), and the chat
 * button sat underneath it, so a shopper on a phone could not open the chat.
 *
 * `launcherLift` is the pure rule (tested); `bottomBars` reads the page.
 */

/** A box in viewport pixels, as `getBoundingClientRect()` gives it. */
export type Box = { top: number; bottom: number; left: number; right: number }

/** How close to the window's bottom edge a bar must reach to count as pinned there. */
const EDGE_PX = 32
/** Anything taller than this share of the window is an overlay (a drawer, a modal), not a bar. */
const MAX_BAR_SHARE = 0.5

/** Taller than half the window: an overlay (a drawer, a modal, a menu), not a bar. */
export function isOverlay(box: Box, viewportHeight: number): boolean {
  return box.bottom - box.top > viewportHeight * MAX_BAR_SHARE
}

/**
 * How far up (px from the window's bottom edge) the chat button must sit to clear every bar that
 * is pinned to the bottom and overlaps the button's column. 0 when nothing is in the way. Tall
 * overlays (an open cart drawer, a menu) are ignored: they come and go, and the button should
 * not jump over them.
 */
export function launcherLift(
  bars: readonly Box[],
  launcher: Pick<Box, 'left' | 'right'>,
  viewportHeight: number,
): number {
  let lift = 0
  for (const bar of bars) {
    const pinned = bar.bottom >= viewportHeight - EDGE_PX
    const short = !isOverlay(bar, viewportHeight)
    const overlaps = bar.left < launcher.right && bar.right > launcher.left
    if (pinned && short && overlaps) lift = Math.max(lift, viewportHeight - bar.top)
  }
  return Math.max(0, Math.round(lift))
}

/** The merchant's launcher heights (theme editor › Inbox chat › Position), above the safe area. */
const LAUNCHER_BOTTOM = { lowest: '1rem', higher: '5.5rem', highest: '10rem' } as const

/** The gap kept between a bar in the way and the lifted chat button. */
const LIFT_GAP = '0.75rem'

/**
 * The chat button's CSS `bottom`: the merchant's height above the safe area, or just above the
 * bars in the way (`launcherLift`) when they reach higher. The chat card adds its offset to it.
 */
export function launcherBottom(vertical: keyof typeof LAUNCHER_BOTTOM, lift: number): string {
  const base = `${LAUNCHER_BOTTOM[vertical]} + env(safe-area-inset-bottom)`
  return lift > 0 ? `max(${base}, ${lift}px + ${LIFT_GAP})` : `(${base})`
}

/** Marks the chat's own elements, which never count as a bar in the way. */
export const CHAT_ROOT_ATTR = 'data-chat-root'

/** The nearest fixed or sticky element at or above `el`, or null when it scrolls with the page. */
function pinnedAncestor(el: Element | null): Element | null {
  for (let at = el; at && at !== document.body && at !== document.documentElement; ) {
    const position = getComputedStyle(at).position
    if (position === 'fixed' || position === 'sticky') return at
    at = at.parentElement
  }
  return null
}

/**
 * The fixed or sticky elements along the bottom edge of the window under the chat button's
 * column: sampled with `elementsFromPoint` at three points across the button, just above the
 * bottom edge, skipping the chat's own elements.
 */
export function bottomBars(launcher: Pick<Box, 'left' | 'right'>): Box[] {
  const found = new Set<Element>()
  const y = window.innerHeight - 2
  const inset = Math.min(8, (launcher.right - launcher.left) / 4)
  for (const x of [
    launcher.left + inset,
    (launcher.left + launcher.right) / 2,
    launcher.right - inset,
  ]) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.closest(`[${CHAT_ROOT_ATTR}]`)) continue
      const bar = pinnedAncestor(el)
      if (bar && !bar.closest(`[${CHAT_ROOT_ATTR}]`)) found.add(bar)
    }
  }
  return [...found].map((el) => el.getBoundingClientRect())
}

/**
 * Whether a theme overlay (an open cart drawer, a menu, a modal) is open over the chat button's
 * spot. The button sits above theme layers, so it would otherwise cover the drawer's own buttons;
 * the launcher hides while this is true.
 */
export function overlayOver(launcher: Box): boolean {
  const x = (launcher.left + launcher.right) / 2
  const y = (launcher.top + launcher.bottom) / 2
  const under = document.elementsFromPoint(x, y).find((el) => !el.closest(`[${CHAT_ROOT_ATTR}]`))
  const layer = pinnedAncestor(under ?? null)
  return layer !== null && isOverlay(layer.getBoundingClientRect(), window.innerHeight)
}
