/**
 * SOURCE OF TRUTH KEYWORDS: spec cells, spec rows, spec table, product fields
 * WHAT:  The theme's spec snippets as pure functions over the product's extra fields
 *        (`ProductDetail.fields`, its `custom` metafields): the buy box spec grid
 *        (snippets/spec-cells), "Label: Value" rows (snippets/spec-rows) and the key-driven
 *        spec table (snippets/spec-table).
 * WHY:   The merchant writes the list once in the section ("Sensor | spec_sensor | sensor")
 *        and every product shows the fields it has; blanks vanish, and so do group labels
 *        with nothing under them.
 * WHERE: Drawn by `components/product-spec-grid.tsx` and `components/product-accordions.tsx`.
 */
import type { ProductFieldText } from './types'

type Fields = Record<string, ProductFieldText> | undefined

export type SpecCell = { label: string; value: string; icon: string; group: string | null }
export type SpecRow = { label: string; value: string; sub: string }

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

/** `## Group` lines and `Label | key | icon` cells; a group label rides on its first shown cell. */
export function specCells(fields: Fields, spec: string): SpecCell[] {
  const out: SpecCell[] = []
  let pending: string | null = null
  for (const line of lines(spec)) {
    if (line.startsWith('## ')) {
      pending = line.slice(3).trim() || null
      continue
    }
    const [label = '', key = '', icon = ''] = line.split('|').map((p) => p.trim())
    const value = key ? fields?.[key]?.text.trim() : ''
    if (!label || !value) continue
    out.push({ label, value, icon: icon === 'none' ? '' : icon, group: pending })
    pending = null
  }
  return out
}

/** "Label: Value | sub-line" per line; a line without a colon is a bare value. */
export function specRows(text: string): SpecRow[] {
  return lines(text).map((line) => {
    const [main = '', sub = ''] = line.split('|').map((p) => p.trim())
    const colon = main.indexOf(':')
    return colon > 0
      ? { label: main.slice(0, colon).trim(), value: main.slice(colon + 1).trim(), sub }
      : { label: '', value: main, sub }
  })
}

/** A field by the theme's lookup: `key` itself, then `spec_<key>`. */
const probe = (fields: Fields, key: string) =>
  fields?.[key]?.text.trim() || fields?.[`spec_${key}`]?.text.trim() || ''

/** `key | Label` rows with a value on this product, the `omit` keys left out. */
export function specTable(fields: Fields, rows: string, omit: string[] = []): SpecRow[] {
  return lines(rows).flatMap((line) => {
    const [key = '', label = ''] = line.split('|').map((p) => p.trim())
    if (!key || omit.includes(key)) return []
    const value = probe(fields, key)
    return value ? [{ label: label || key, value, sub: '' }] : []
  })
}
