/** SOURCE OF TRUTH: Shopify theme schema shapes — WHAT: the `{% schema %}` of a section or theme block, a JSON template (`templates/*.json`, section groups) and how both are read (comments allowed, as Shopify allows) / WHY: the importer, the Liquid engine and the editor's generated fields must agree on one reading of a theme; browser safe (no database) */

/** One setting in a section, block or theme settings schema. */
export type ShopifySetting = {
  type: string
  id?: string | undefined
  label?: string | undefined
  info?: string | undefined
  default?: unknown
  placeholder?: string | undefined
  options?: { value: string; label?: string | undefined; group?: string | undefined }[] | undefined
  min?: number | undefined
  max?: number | undefined
  step?: number | undefined
  unit?: string | undefined
  /** `header` and `paragraph` settings carry text only. */
  content?: string | undefined
  limit?: number | undefined
  visible_if?: string | undefined
  /** A `color_scheme_group`'s colours: the settings every scheme carries. */
  definition?: ShopifySetting[] | undefined
}

export type ShopifyBlockSchema = {
  type: string
  name?: string | undefined
  limit?: number | undefined
  settings?: ShopifySetting[] | undefined
}

export type ShopifySectionSchema = {
  name?: string | undefined
  tag?: string | undefined
  class?: string | undefined
  limit?: number | undefined
  settings?: ShopifySetting[] | undefined
  blocks?: ShopifyBlockSchema[] | undefined
  max_blocks?: number | undefined
  presets?: { name?: string; settings?: Record<string, unknown>; blocks?: unknown }[] | undefined
  enabled_on?: unknown
  disabled_on?: unknown
}

/** A section as a JSON template stores it. */
export type ShopifyTemplateSection = {
  type: string
  disabled?: boolean | undefined
  settings?: Record<string, unknown> | undefined
  blocks?: Record<string, ShopifyTemplateBlock> | undefined
  block_order?: string[] | undefined
}

export type ShopifyTemplateBlock = {
  type: string
  disabled?: boolean | undefined
  settings?: Record<string, unknown> | undefined
  blocks?: Record<string, ShopifyTemplateBlock> | undefined
  block_order?: string[] | undefined
  static?: boolean | undefined
}

/** Shopify nests theme blocks at most this deep (a tab's contents inside a tab); deeper is a loop. */
export const MAX_BLOCK_DEPTH = 8

/** `templates/*.json` and `sections/*-group.json`. */
export type ShopifyJsonTemplate = {
  name?: string | undefined
  type?: string | undefined
  layout?: string | false | undefined
  sections: Record<string, ShopifyTemplateSection>
  order: string[]
}

const SCHEMA_OPEN = /{%-?\s*schema\s*-?%}/g
const SCHEMA_CLOSE = /{%-?\s*endschema\s*-?%}/g

/**
 * Where the real `{% schema %}` block sits: the last `endschema`, and the last `schema`
 * before it. A comment that merely mentions `{% schema %}` (themes do) is not it.
 */
function schemaSpan(
  source: string,
): { start: number; bodyStart: number; bodyEnd: number; end: number } | null {
  const closes = [...source.matchAll(SCHEMA_CLOSE)]
  const close = closes[closes.length - 1]
  if (!close || close.index === undefined) return null
  const opens = [...source.slice(0, close.index).matchAll(SCHEMA_OPEN)]
  const open = opens[opens.length - 1]
  if (!open || open.index === undefined) return null
  return {
    start: open.index,
    bodyStart: open.index + open[0].length,
    bodyEnd: close.index,
    end: close.index + close[0].length,
  }
}

/**
 * Strips `/* *\/` and `//` comments outside strings, as Shopify's JSON files allow
 * them (the CLI writes a header comment into every template).
 */
export function stripJsonComments(text: string): string {
  let out = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (inString) {
      out += ch
      if (ch === '\\') {
        out += next ?? ''
        i++
      } else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      out += ch
    } else if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? text.length : end + 1
    } else if (ch === '/' && next === '/') {
      const end = text.indexOf('\n', i + 2)
      i = end === -1 ? text.length : end - 1
    } else out += ch
  }
  return out
}

/** JSON with comments and trailing commas, or null when it is not JSON at all. */
export function parseThemeJson<T = unknown>(text: string): T | null {
  const clean = stripJsonComments(text)
  try {
    return JSON.parse(clean) as T
  } catch {
    try {
      return JSON.parse(clean.replace(/,(\s*[}\]])/g, '$1')) as T
    } catch {
      return null
    }
  }
}

/** A Liquid file's `{% schema %}` (null when it has none or it is not JSON). */
export function extractSchema(source: string): ShopifySectionSchema | null {
  const span = schemaSpan(source)
  if (!span) return null
  const parsed = parseThemeJson<ShopifySectionSchema>(source.slice(span.bodyStart, span.bodyEnd))
  return parsed && typeof parsed === 'object' ? parsed : null
}

/** The Liquid without its schema block, what the engine renders. */
export function withoutSchema(source: string): string {
  const span = schemaSpan(source)
  return span ? source.slice(0, span.start) + source.slice(span.end) : source
}

/** A JSON template or section group, or null when it is not one. */
export function parseJsonTemplate(text: string): ShopifyJsonTemplate | null {
  const parsed = parseThemeJson<ShopifyJsonTemplate>(text)
  if (!parsed || typeof parsed !== 'object' || typeof parsed.sections !== 'object') return null
  const sections = parsed.sections ?? {}
  const order = Array.isArray(parsed.order)
    ? parsed.order.filter((k) => typeof k === 'string' && k in sections)
    : Object.keys(sections)
  return { ...parsed, sections, order }
}

/** Settings that hold a value (headers and paragraphs are labels only). */
export const isValueSetting = (s: ShopifySetting): s is ShopifySetting & { id: string } =>
  typeof s.id === 'string' && s.type !== 'header' && s.type !== 'paragraph'

/** A setting's default as Shopify applies it when a section has no value saved. */
export function settingDefaults(settings: ShopifySetting[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const s of settings ?? []) {
    if (!isValueSetting(s)) continue
    if (s.default !== undefined) out[s.id] = s.default
    else if (s.type === 'checkbox') out[s.id] = false
  }
  return out
}
