/** SOURCE OF TRUTH: Shopify app blocks in imported themes — WHAT: which app blocks (`shopify://apps/…` in a template) one of our apps draws instead, the slot each leaves in the Liquid HTML for the storefront to fill with that app's widget, the editor's placeholder for the rest, and the `block` object a section's Liquid sees for one (`type` is `@app`, as on Shopify) / WHY: an app block is Shopify-hosted code we cannot run; left out, a product tab holding only Judge.me's review widget disappeared, and sections that branch on `when '@app'` drew nothing or the wrong block */
import {
  APP_BLOCK_MISSING_ATTR,
  APP_BLOCK_SLOT_ATTR,
  appBlockName,
  appBlockSlot,
  isAppBlockType,
} from './app-block-slots'
import { escapeAttr } from './filters'
import type { LiquidPageContext } from './page-context'

/**
 * Where an app block's own type (`shopify://apps/…`) rides on the `block` object, since its
 * `type` reads `@app` the way Shopify's Liquid shows it.
 */
export const APP_BLOCK_TYPE_KEY = 'commerce_app_type'

/** Shopify's `block.type` for an app block, which themes branch on (`{% when '@app' %}`). */
export const APP_BLOCK_LIQUID_TYPE = '@app'

/** The block's real type: the app's own for an app block, else its type. */
function sourceType(block: { type?: unknown; [APP_BLOCK_TYPE_KEY]?: unknown }): string {
  const own = block[APP_BLOCK_TYPE_KEY]
  if (typeof own === 'string') return own
  return typeof block.type === 'string' ? block.type : ''
}

/** The `block` object for one stored block's type: `@app` with its own type alongside for app blocks. */
export function liquidBlockType(type: string): Record<string, string> {
  return isAppBlockType(type)
    ? { type: APP_BLOCK_LIQUID_TYPE, [APP_BLOCK_TYPE_KEY]: type }
    : { type }
}

/** Whether a Liquid `block` object is an app block. */
export function isLiquidAppBlock(block: unknown): boolean {
  if (!block || typeof block !== 'object') return false
  return isAppBlockType(sourceType(block as { type?: unknown }))
}

/**
 * The HTML an app block renders as: a slot for our widget, holding the heading Judge.me's
 * widget opens with (so a tab that checks its contents for text keeps the tab). For a block we
 * have no widget for (or whose app, Reviews, is not installed) the editor canvas gets a
 * placeholder naming it and the storefront nothing. A pass where that is still loading also
 * prints nothing, and the next pass has it.
 */
export function appBlockHtml(
  ctx: LiquidPageContext,
  block: { type?: unknown; shopify_attributes?: unknown },
): string {
  const type = sourceType(block)
  const slot = type ? appBlockSlot(type) : null
  const attrs = typeof block.shopify_attributes === 'string' ? ` ${block.shopify_attributes}` : ''
  if (!slot || !ctx.cache.judgeme()) return missingAppBlock(ctx, type, attrs)
  return `<div class="commerce-app-block commerce-app-block--${slot}" ${APP_BLOCK_SLOT_ATTR}="${escapeAttr(slot)}"${attrs}>${slot === 'reviews' ? '<h2 class="commerce-app-block__heading h4">Customer reviews</h2>' : ''}</div>`
}

/** Plain, theme-neutral look for the placeholder: it must read on any theme's colours. */
const PLACEHOLDER_STYLE =
  'margin:0.75rem 0;padding:0.75rem 1rem;border:0.0625rem dashed currentColor;border-radius:0.5rem;opacity:0.7;font:500 0.875rem/1.4 system-ui,sans-serif'

/**
 * An app block none of our apps draws: in the editor (design mode) a dashed box saying so, which
 * the admin canvas relabels in the merchant's language; on the storefront nothing. The block stays
 * in the template either way.
 */
function missingAppBlock(ctx: LiquidPageContext, type: string, attrs: string): string {
  if (!ctx.options.request.designMode || !isAppBlockType(type)) return ''
  const name = appBlockName(type)
  return `<div class="commerce-app-block commerce-app-block--missing" ${APP_BLOCK_MISSING_ATTR}="${escapeAttr(name)}" style="${PLACEHOLDER_STYLE}"${attrs}>App block: ${escapeAttr(name)} (not available)</div>`
}
