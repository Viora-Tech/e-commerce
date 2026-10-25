import type { TemplateSection } from '@commerce/core/theme'
import type { CustomizeDoc } from '@/lib/customize-doc'
import { findBlock, zoneItems } from '@/lib/customize-slots'

/** The block picker's groups (Figma 696:87552): what a block is for, not how it is built. */
export const BLOCK_GROUPS = {
  text: ['Heading', 'Text', 'Button', 'Badge', 'Icon'],
  media: ['Image', 'VideoPlayer', 'ProductCard', 'CustomHtml'],
  layout: ['Columns', 'Grid', 'Group', 'Accordion', 'Tabs', 'Carousel', 'Divider', 'Spacer'],
} as const

export type BlockGroupId = keyof typeof BLOCK_GROUPS

type SlotField = {
  type?: string
  allow?: readonly string[]
  arrayFields?: Record<string, SlotField>
}

/**
 * The block types a slot takes: its field's `allow` list, or null when it takes any block.
 * A slot inside an array item (`columns.1.content`) reads the array's item field.
 */
export function slotAllows(
  doc: CustomizeDoc,
  zone: string,
  fieldsOf: (type: string) => Record<string, SlotField> | undefined,
): readonly string[] | null {
  const at = zone.indexOf(':')
  if (at < 0) return null
  const owner = findBlock(doc, zone.slice(0, at))
  if (!owner) return null
  const path = zone.slice(at + 1).split('.')
  let field: SlotField | undefined = fieldsOf(owner.type)?.[path[0] ?? '']
  for (const key of path.slice(1)) {
    if (!field || /^\d+$/.test(key)) continue
    field = field.arrayFields?.[key]
  }
  return field?.type === 'slot' && field.allow?.length ? field.allow : null
}

/** Where a new block lands, for the picker's footer: inside which block, after which one. */
export function blockLanding(
  doc: CustomizeDoc,
  zone: string,
  index: number,
): { parent: TemplateSection | null; before: TemplateSection | null } {
  const at = zone.indexOf(':')
  return {
    parent: at < 0 ? null : findBlock(doc, zone.slice(0, at)),
    before: index > 0 ? (zoneItems(doc, zone)[index - 1] ?? null) : null,
  }
}
