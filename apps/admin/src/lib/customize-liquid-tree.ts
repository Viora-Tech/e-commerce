import {
  type LiquidBlockItem,
  type ShopifySectionSchema,
  schemaText,
  settingDefaults,
} from '@commerce/core/theme-import'
import type { ImportedTheme } from './imported-sections'

/**
 * The blocks of an imported Shopify section as the Layers tree shows them, Shopify-style: each
 * slide, logo or column as its own row under the section, with "Add block", hide, reorder and
 * remove. Plain logic with no JSX; every change returns the section's next props, so the tree
 * dispatches it as one Puck edit (one undo step).
 */

/** One block row: the block's own text when it has some (a slide's heading), else its type. */
export type LiquidBlockRow = {
  index: number
  id: string
  type: string
  title: string
  /** The block type's name, shown after a title taken from the block's own text. */
  typeName: string | null
  hidden: boolean
}

/** A block type the merchant can add. */
export type LiquidBlockType = { type: string; name: string }

/** Settings read as the block's own words, in order of preference. */
const TITLE_KEYS = ['heading', 'title', 'text', 'label', 'name', 'caption', 'subheading']

const itemsOf = (props: Record<string, unknown>): LiquidBlockItem[] =>
  Array.isArray(props.blocks) ? (props.blocks as LiquidBlockItem[]) : []

const stripTags = (value: string) =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Block types the section's schema allows, with `@theme` opening up the theme's own blocks. */
export function liquidBlockTypes(
  schema: ShopifySectionSchema | undefined,
  theme: ImportedTheme,
): LiquidBlockType[] {
  const out: LiquidBlockType[] = []
  for (const b of schema?.blocks ?? []) {
    if (b.type === '@app') continue
    if (b.type === '@theme') {
      for (const [type, block] of Object.entries(theme.blockSchemas)) {
        if (type.startsWith('_')) continue // private blocks only nest inside other blocks
        out.push({ type, name: schemaText(block.name, theme.schemaLocale) || type })
      }
      continue
    }
    const fallback = theme.blockSchemas[b.type]?.name
    out.push({
      type: b.type,
      name: schemaText(b.name ?? fallback, theme.schemaLocale) || b.type,
    })
  }
  return out
}

/** The section's blocks as tree rows. */
export function liquidBlockRows(
  props: Record<string, unknown>,
  types: readonly LiquidBlockType[],
): LiquidBlockRow[] {
  const names = new Map(types.map((t) => [t.type, t.name]))
  return itemsOf(props).map((item, index) => {
    const typeName = names.get(item.type) ?? item.type
    const text = TITLE_KEYS.map((k) => item.settings?.[k])
      .filter((v): v is string => typeof v === 'string')
      .map(stripTags)
      .find((v) => v !== '')
    return {
      index,
      id: item.id,
      type: item.type,
      title: text ? text.slice(0, 60) : typeName,
      typeName: text ? typeName : null,
      hidden: item.disabled === true,
    }
  })
}

/** Whether one more block fits under the schema's `max_blocks` (Shopify's default is 50). */
export function liquidCanAddBlock(
  props: Record<string, unknown>,
  schema: ShopifySectionSchema | undefined,
): boolean {
  return itemsOf(props).length < (schema?.max_blocks ?? 50)
}

/** A block id no other block of the section has, in Shopify's `type_xxxxxx` form. */
function freshId(type: string, taken: ReadonlySet<string>): string {
  for (;;) {
    const id = `${type.replace(/[^a-z0-9_-]/gi, '_')}_${Math.random().toString(36).slice(2, 8)}`
    if (!taken.has(id)) return id
  }
}

/** Props with a new block of `type` at the end, filled with its schema's defaults. */
export function withLiquidBlockAdded(
  props: Record<string, unknown>,
  type: string,
  schema: ShopifySectionSchema | undefined,
  theme: ImportedTheme,
): Record<string, unknown> {
  const items = itemsOf(props)
  const settings =
    schema?.blocks?.find((b) => b.type === type)?.settings ?? theme.blockSchemas[type]?.settings
  const block: LiquidBlockItem = {
    id: freshId(type, new Set(items.map((b) => b.id))),
    type,
    settings: settingDefaults(settings),
  }
  return { ...props, blocks: [...items, block] }
}

/** Props with block `index` copied right after itself, under a new id. */
export function withLiquidBlockDuplicated(
  props: Record<string, unknown>,
  index: number,
): Record<string, unknown> {
  const items = itemsOf(props)
  const source = items[index]
  if (!source) return props
  const copy: LiquidBlockItem = {
    ...structuredClone(source),
    id: freshId(source.type, new Set(items.map((b) => b.id))),
  }
  return { ...props, blocks: [...items.slice(0, index + 1), copy, ...items.slice(index + 1)] }
}

/** Props without block `index`. */
export function withLiquidBlockRemoved(
  props: Record<string, unknown>,
  index: number,
): Record<string, unknown> {
  return { ...props, blocks: itemsOf(props).filter((_, i) => i !== index) }
}

/** Props with block `index` hidden, or shown again (Shopify's `disabled`). */
export function withLiquidBlockToggled(
  props: Record<string, unknown>,
  index: number,
): Record<string, unknown> {
  return {
    ...props,
    blocks: itemsOf(props).map((b, i) => {
      if (i !== index) return b
      const { disabled: _, ...rest } = b
      return b.disabled ? rest : { ...rest, disabled: true }
    }),
  }
}

/** Props with the blocks in the order of `ids` (a drag in the tree). */
export function withLiquidBlocksOrdered(
  props: Record<string, unknown>,
  ids: readonly string[],
): Record<string, unknown> {
  const byId = new Map(itemsOf(props).map((b) => [b.id, b]))
  const ordered = ids.flatMap((id) => {
    const b = byId.get(id)
    return b ? [b] : []
  })
  return ordered.length === byId.size ? { ...props, blocks: ordered } : props
}

/** Props with one setting of block `index` changed. */
export function withLiquidBlockSettings(
  props: Record<string, unknown>,
  index: number,
  settings: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...props,
    blocks: itemsOf(props).map((b, i) => (i === index ? { ...b, settings } : b)),
  }
}
