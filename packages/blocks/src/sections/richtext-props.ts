import { richtextNode } from '../richtext-node'

/**
 * SOURCE OF TRUTH KEYWORDS: richtextProps, richtext fields sanitised before render
 * WHAT:  A section's props with every `richtext` field (top level, in array items, in objects)
 *        sanitised into a `RichHtml` element (`../richtext-node.ts`).
 * WHY:   Sections hand body copy to client components (newsletter, FAQ accordion, carousel
 *        slides, hero copy), which draw it in the browser too. Sanitised here, on the server,
 *        the browser draws the server's HTML and never loads sanitize-html. Sections already
 *        take these props as React nodes (Puck hands over its inline editor while editing).
 * WHERE: `./framed.tsx` runs it before every section's body.
 */

type FieldShape = {
  type?: string
  arrayFields?: Record<string, FieldShape>
  objectFields?: Record<string, FieldShape>
}

function mapValue(value: unknown, field: FieldShape | undefined): unknown {
  if (!field) return value
  if (field.type === 'richtext') return richtextNode(value)
  if (field.type === 'array' && Array.isArray(value) && field.arrayFields) {
    const fields = field.arrayFields
    return value.map((item) => richtextProps(item, fields))
  }
  if (field.type === 'object' && field.objectFields) return richtextProps(value, field.objectFields)
  return value
}

/** `props` with its richtext fields sanitised; other values (and non-objects) untouched. */
export function richtextProps<T>(props: T, fields: Record<string, unknown>): T {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return props
  const out: Record<string, unknown> = { ...(props as Record<string, unknown>) }
  for (const [key, field] of Object.entries(fields as Record<string, FieldShape>)) {
    if (key in out) out[key] = mapValue(out[key], field)
  }
  return out as T
}
