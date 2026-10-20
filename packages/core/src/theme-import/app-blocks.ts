/** SOURCE OF TRUTH: Shopify app blocks in imported themes — WHAT: which app blocks (`shopify://apps/…` in a template) one of our apps draws instead, and the slot each leaves in the Liquid HTML for the storefront to fill with that app's widget / WHY: an app block is Shopify-hosted code we cannot run; left out, a product tab holding only Judge.me's review widget disappeared, so reviews imported into our Reviews app never showed on the page */
import { APP_BLOCK_SLOT_ATTR, appBlockSlot } from './app-block-slots'
import { escapeAttr } from './filters'
import type { LiquidPageContext } from './page-context'

/**
 * The HTML an app block renders as: a slot for our widget, holding the heading Judge.me's
 * widget opens with (so a tab that checks its contents for text keeps the tab). Empty when
 * we have no widget for the block, or the app behind it (Reviews) is not installed; a pass
 * where that is still loading also prints nothing, and the next pass has it.
 */
export function appBlockHtml(
  ctx: LiquidPageContext,
  block: { type?: unknown; shopify_attributes?: unknown },
): string {
  const slot = typeof block.type === 'string' ? appBlockSlot(block.type) : null
  if (slot !== 'reviews' || !ctx.cache.judgeme()) return ''
  const attrs = typeof block.shopify_attributes === 'string' ? ` ${block.shopify_attributes}` : ''
  return `<div class="commerce-app-block commerce-app-block--${slot}" ${APP_BLOCK_SLOT_ATTR}="${escapeAttr(slot)}"${attrs}><h2 class="commerce-app-block__heading h4">Customer reviews</h2></div>`
}
