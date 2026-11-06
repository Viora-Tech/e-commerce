/** SOURCE OF TRUTH: imported theme setting values — WHAT: a Shopify section's or block's settings as a theme template stores them (images pointing at Files, Shopify links as our paths) and its blocks in order / WHY: split from import.ts; the importer and its tests share one reading of setting values */
import type { LiquidBlockItem } from './fields'
import { type Hosted, SHOP_IMAGE, SHOP_VIDEO } from './import-media'
import {
  MAX_BLOCK_DEPTH,
  type ShopifySectionSchema,
  type ShopifySetting,
  type ShopifyTemplateBlock,
} from './schema'
import { isDynamicSource, shopifyUrlToPath } from './settings-values'

/**
 * A stored setting value: image settings become `{ url, alt }` pointing at Files,
 * Shopify resource links become our paths. Product, collection and menu settings keep
 * their handles (ours match, since the catalogue import keeps Shopify's handles).
 */
function storedValue(setting: ShopifySetting | undefined, value: unknown, hosted: Hosted): unknown {
  if (isDynamicSource(value)) return value
  if (typeof value === 'string') {
    const video = SHOP_VIDEO.exec(value)
    if (video?.[1]) {
      const v = hosted.videos.get(video[1])
      return v ? { url: v.url, poster: v.poster, mobileUrl: v.mobileUrl } : ''
    }
    const m = SHOP_IMAGE.exec(value)
    if (m?.[1]) {
      const h = hosted.images.get(m[1])
      if (setting && setting.type !== 'image_picker') return h?.url ?? ''
      return h ? { url: h.url, alt: '', width: h.width, height: h.height } : { url: '', alt: '' }
    }
    if (value.startsWith('shopify://')) return shopifyUrlToPath(value)
    if (setting?.type === 'image_picker')
      return value ? { url: value, alt: '' } : { url: '', alt: '' }
  }
  if (setting?.type === 'image_picker' && (value === null || value === undefined)) {
    return { url: '', alt: '' }
  }
  return value
}

export function storedSettings(
  schema: ShopifySetting[] | undefined,
  values: Record<string, unknown> | undefined,
  hosted: Hosted,
): Record<string, unknown> {
  const byId = new Map((schema ?? []).flatMap((s) => (s.id ? [[s.id, s] as const] : [])))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(values ?? {})) out[k] = storedValue(byId.get(k), v, hosted)
  for (const s of schema ?? []) {
    if (s.id && s.type === 'image_picker' && !(s.id in out)) out[s.id] = { url: '', alt: '' }
  }
  return out
}

/**
 * A section's (or block's) blocks in order, nested ones included: a product-tabs section's
 * tabs hold the theme blocks shown inside each tab.
 */
export function templateBlocks(
  parent: Pick<ShopifyTemplateBlock, 'blocks' | 'block_order'>,
  schema: ShopifySectionSchema | null,
  hosted: Hosted,
  depth: number,
): LiquidBlockItem[] {
  if (depth >= MAX_BLOCK_DEPTH) return []
  // `block_order` leaves static blocks out; the theme's code places them by id.
  const placed = parent.block_order ?? []
  const rest = Object.keys(parent.blocks ?? {}).filter((id) => !placed.includes(id))
  const order = parent.block_order
    ? [...placed, ...rest.filter((id) => parent.blocks?.[id]?.static)]
    : rest
  return order.flatMap((id) => {
    const b = parent.blocks?.[id]
    if (!b) return []
    const blockSchema = schema?.blocks?.find((x) => x.type === b.type)
    const nested = templateBlocks(b, schema, hosted, depth + 1)
    return [
      {
        id,
        type: b.type,
        ...(b.disabled ? { disabled: true } : {}),
        ...(b.static ? { static: true } : {}),
        settings: storedSettings(blockSchema?.settings, b.settings, hosted),
        ...(nested.length ? { blocks: nested } : {}),
      },
    ]
  })
}
