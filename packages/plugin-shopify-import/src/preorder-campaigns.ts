/**
 * Shopify pre-order apps keep their campaigns out of the Admin API (app-owned metafields), but
 * Essential Pre-Order writes every campaign into each storefront page for its app embed: a
 * `preorder-app-data` attribute holding `{ preorderCampaigns: [{ content: { message },
 * placement: { specificProducts: [<variant id>, …] } }] }`. The import reads the store's home page
 * once and, per variant, the message it sells under (#936) and that it sells as a pre-order
 * (#962): the campaign is Shopify's per-variant pre-order. A store without the app, behind a
 * password, or not answering gives none, and products import as before.
 */
import type { ShopifyClient } from './shopify-client'
import { primaryOrigin, STOREFRONT_TIMEOUT_MS } from './storefront-filters'
import type { NProduct } from './types'

type RawCampaign = {
  content?: { message?: unknown } | null
  placement?: { specificProducts?: unknown } | null
}

const ENTITIES: Record<string, string> = {
  quot: '"',
  amp: '&',
  lt: '<',
  gt: '>',
  apos: "'",
  '#39': "'",
  '#x27': "'",
}

/** An HTML attribute value back to its text (the entities Shopify's `escape` writes). */
const unescapeAttr = (value: string): string =>
  value.replace(/&(quot|amp|lt|gt|apos|#39|#x27);/g, (_m, name: string) => ENTITIES[name] ?? '')

/** The numeric id at the end of a Shopify gid (`gid://shopify/ProductVariant/123` → `123`). */
export const shopifyNumericId = (id: string | null): string | null =>
  id ? (/(\d+)$/.exec(id)?.[1] ?? null) : null

/** Variant id → its campaign's message, from a storefront page's Essential Pre-Order data. */
export function preorderCampaignsFromHtml(html: string): Map<string, string> {
  const out = new Map<string, string>()
  const attr = /\spreorder-app-data="([^"]*)"/.exec(html)?.[1]
  if (!attr) return out
  let campaigns: RawCampaign[]
  try {
    const data = JSON.parse(unescapeAttr(attr)) as { preorderCampaigns?: unknown }
    campaigns = Array.isArray(data.preorderCampaigns) ? data.preorderCampaigns : []
  } catch {
    return out
  }
  for (const c of campaigns) {
    const message = typeof c.content?.message === 'string' ? c.content.message.trim() : ''
    const ids = c.placement?.specificProducts
    if (!Array.isArray(ids)) continue
    for (const id of ids) {
      const key = String(id)
      // A variant in two campaigns keeps the first, as the app's embed does.
      if (/^\d+$/.test(key) && !out.has(key)) out.set(key, message)
    }
  }
  return out
}

/** The store's campaigns, read off its home page; empty when the page cannot be read. */
export async function storefrontPreorderCampaigns(
  client: ShopifyClient,
): Promise<Map<string, string>> {
  const fallback = `https://${client.shopDomain}`
  const primary = await primaryOrigin(client)
  const origins = primary && primary !== fallback ? [primary, fallback] : [fallback]
  for (const origin of origins) {
    try {
      const res = await client.fetchImpl(`${origin}/`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(STOREFRONT_TIMEOUT_MS),
        headers: { accept: 'text/html' },
      })
      if (!res.ok) continue
      const campaigns = preorderCampaignsFromHtml(await res.text())
      if (campaigns.size > 0) return campaigns
    } catch {
      // Try the next address; none answering means no campaigns to bring over.
    }
  }
  return new Map()
}

/**
 * A product's variants in a campaign sell as pre-orders (as the app's "continue selling" does),
 * and the product takes the campaign's message as its note. Variants in no campaign keep what
 * Shopify's inventory policy says. Changes `p` in place; a product in no campaign is untouched.
 */
export function applyPreorderCampaigns(p: NProduct, campaigns: ReadonlyMap<string, string>): void {
  if (campaigns.size === 0) return
  let note: string | undefined
  for (const v of p.variants) {
    const id = shopifyNumericId(v.sourceId)
    const message = id ? campaigns.get(id) : undefined
    if (message === undefined) continue
    v.sellsOutOfStock = true
    if (note === undefined && message) note = message
  }
  if (note !== undefined) p.preorderNote = note
}
