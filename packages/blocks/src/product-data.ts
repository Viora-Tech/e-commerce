/**
 * SOURCE OF TRUTH KEYWORDS: specRows, sizeGuideRows, sizeTableRows, descriptionDoc, product section rows
 * WHAT:  The plain-text row formats the product page sections read (spec groups, the spec
 *        strip, the size guide, the size table) and the product description as a document.
 * WHY:   A merchant types these rows into a textarea, or connects that textarea to a
 *        multi-line product metafield (dynamic sources), so the same text format arrives
 *        either way. The formats are the Zero Drift theme's own (`snippets/spec-group.liquid`,
 *        `sections/product-size-guide.liquid`, `sections/product-size-table.liquid`), so
 *        metafields written for the Shopify theme paste straight in.
 * WHERE: `sections/glide/product-*.tsx` and `components/sections/glide/product-*.tsx`;
 *        `components/product-description.tsx` reads `descriptionDoc` too.
 */
import { parseRichText, plainTextToRichText } from '@commerce/richtext'
import type { ProductDetail } from './types'

export type SpecRow = { label: string; value: string; sub: string }

export type SizeGuideRow = {
  name: string
  dims: string
  measure: string
  tags: string[]
  weight: string
  /** The measurement range as numbers, when it parses; the slider matches against it. */
  range: { min: number; max: number } | null
}

const lines = (text: unknown): string[] =>
  typeof text === 'string'
    ? text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    : []

/**
 * `Label: value | sub-line`, one row per line. The sub-line is split off first so a value
 * with a colon in it still parses; the label is only what sits before the first colon.
 */
export function specRows(text: unknown): SpecRow[] {
  return lines(text).map((line) => {
    const bar = line.indexOf('|')
    const main = bar === -1 ? line : line.slice(0, bar).trim()
    const sub = bar === -1 ? '' : line.slice(bar + 1).trim()
    const colon = main.indexOf(':')
    if (colon === -1) return { label: '', value: main, sub }
    return { label: main.slice(0, colon).trim(), value: main.slice(colon + 1).trim(), sub }
  })
}

/** The headline half of a value: "125 - 8000 Hz (wired and wireless)" → "125 - 8000 Hz". */
export const headline = (value: string): string => value.split('(')[0]?.trim() ?? ''

/** `Name | Dimensions | 17.0 - 18.5 cm | Palm, Claw | 60 g`, one size per line; only the name is required. */
export function sizeGuideRows(text: unknown): SizeGuideRow[] {
  return lines(text).map((line) => {
    const [name = '', dims = '', measure = '', tags = '', weight = ''] = line
      .split('|')
      .map((c) => c.trim())
    const [min, max] = measure
      .replace(/[a-z"]+/gi, '')
      .split('-')
      .map((n) => Number.parseFloat(n))
    const range =
      min !== undefined && max !== undefined && Number.isFinite(min) && Number.isFinite(max)
        ? { min, max }
        : null
    return {
      name,
      dims,
      measure,
      weight,
      range,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    }
  })
}

/** First line is the header row, every line after it a row; cells split on `|`. */
export function sizeTableRows(text: unknown): { head: string[]; rows: string[][] } | null {
  const [first, ...rest] = lines(text).map((l) => l.split('|').map((c) => c.trim()))
  return first ? { head: first, rows: rest } : null
}

/** Imported products hold a plain string; the admin editor writes Lexical JSON. */
export function descriptionDoc(raw: ProductDetail['description']) {
  const doc = parseRichText(raw)
  if (doc) return doc
  return typeof raw === 'string' && raw.trim() ? plainTextToRichText(raw) : null
}
