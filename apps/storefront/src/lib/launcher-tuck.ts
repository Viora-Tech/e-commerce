/**
 * On a phone the Inbox chat button tucks away instead of covering what the shopper is looking
 * at: it hides while the page scrolls down and comes back when the shopper scrolls up (the rule
 * sticky headers and most chat widgets use on phones), and it stays hidden while a buying bar is
 * on screen (the product page's sticky Add to cart, the cart's checkout bar). Above a phone's
 * width nothing tucks: there is room beside the content.
 *
 * `nextTucked` is the pure scroll rule (tested); `buyingBarShown` reads the page. The plain HTML
 * page's chat module (`plain-html/chat-module.ts`) runs the same rule from `chatModuleSpec`.
 */

/** Phone widths, as the chat's own CSS splits them (`max-sm`, under 40rem). */
export const PHONE_QUERY = '(max-width: 39.99rem)'

/** Bars the button never sits over on a phone: a shown sticky add-to-cart, or a marked bar. */
export const TUCK_SELECTOR = '.sticky-atc.is-visible, [data-chat-tuck]'

/** Scrolling less than this (px) in one step is a wobble, not a change of direction. */
export const SCROLL_SLOP = 8

/** Near the top of the page (px) the button always shows. */
export const TOP_ZONE = 160

/** Whether the button is tucked after the page scrolled from `fromY` to `toY`. */
export function nextTucked(tucked: boolean, fromY: number, toY: number): boolean {
  if (toY <= TOP_ZONE) return false
  const moved = toY - fromY
  if (moved > SCROLL_SLOP) return true
  if (moved < -SCROLL_SLOP) return false
  return tucked
}

/** Whether a buying bar (`TUCK_SELECTOR`) is on screen. */
export function buyingBarShown(): boolean {
  for (const el of document.querySelectorAll(TUCK_SELECTOR)) {
    const box = el.getBoundingClientRect()
    if (box.height > 0 && box.bottom > 0 && box.top < window.innerHeight) return true
  }
  return false
}
