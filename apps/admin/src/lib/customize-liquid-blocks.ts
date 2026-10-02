import type { Field } from '@puckeditor/core'

/**
 * Blocks of an imported Shopify section (`@commerce/core/theme-import`, `liquidSectionFields`)
 * differ by type: a slide and a logo have different settings. Puck's array field has one
 * set of item fields, so the section's `settings` item field carries every type's fields in
 * its metadata and Customize shows each card only its own type's.
 */

type Meta = {
  liquidBlockFields?: Record<string, Record<string, Field>>
  liquidBlockNames?: Record<string, string>
}

const metaOf = (field: unknown): Meta =>
  ((field as { metadata?: Meta } | undefined)?.metadata ?? {}) as Meta

/** True for the `blocks` field of an imported section. */
export function isLiquidBlocks(arrayFields: Record<string, Field>): boolean {
  return Boolean(metaOf(arrayFields.settings).liquidBlockFields)
}

/** The item fields to show for one block: its own type's settings. */
export function liquidItemFields(
  arrayFields: Record<string, Field>,
  item: Record<string, unknown>,
): Record<string, Field> {
  const settings = arrayFields.settings
  const perType = metaOf(settings).liquidBlockFields
  if (!settings || !perType) return arrayFields
  const type = typeof item.type === 'string' ? item.type : ''
  return { settings: { ...settings, objectFields: perType[type] ?? {} } as Field }
}

/** A block card's title: its first text setting, else its type's name. */
export function liquidItemTitle(field: unknown, item: Record<string, unknown>): string | null {
  const names = metaOf(field).liquidBlockNames
  if (!names) return null
  const type = typeof item.type === 'string' ? item.type : ''
  const settings = (item.settings ?? {}) as Record<string, unknown>
  const text = ['heading', 'title', 'text', 'label', 'name']
    .map((k) => settings[k])
    .find((v): v is string => typeof v === 'string' && v.trim() !== '')
  const name = names[type] ?? type
  return text ? `${name}: ${text.replace(/<[^>]*>/g, '').slice(0, 40)}` : name
}
