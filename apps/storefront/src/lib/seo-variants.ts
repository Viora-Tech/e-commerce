/**
 * Variant facts for a product's structured data: which schema.org property each option is
 * (Google's product-variants markup reads `size`, `color`, `material` and `pattern`), and one
 * variant's option values as Product properties. Pure; `productGraph` in `seo.ts` builds the
 * `ProductGroup` from it.
 */

export type LdOption = { name: string; values: { id: string; value: string }[] }

/** Option names Google's `variesBy` understands, lower-cased, to their schema.org property. */
const SCHEMA_PROPS: Record<string, 'size' | 'color' | 'material' | 'pattern'> = {
  size: 'size',
  color: 'color',
  colour: 'color',
  material: 'material',
  pattern: 'pattern',
}

const propOf = (name: string) => SCHEMA_PROPS[name.trim().toLowerCase()]

/** `variesBy`: the schema.org URL of each option Google understands, in option order. */
export function variesBy(options: readonly LdOption[]): string[] {
  const props = options.flatMap((o) => {
    const prop = propOf(o.name)
    return prop ? [`https://schema.org/${prop}`] : []
  })
  return [...new Set(props)]
}

/**
 * One variant's options as Product properties: `color: "Black"` for the ones Google reads, the
 * rest (switch type, skates) as `additionalProperty` so an agent still sees every choice.
 */
export function variantOptionProps(
  options: readonly LdOption[],
  valueIds: readonly string[] | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const extra: { '@type': 'PropertyValue'; name: string; value: string }[] = []
  for (const option of options) {
    const value = option.values.find((v) => valueIds?.includes(v.id))?.value
    if (!value) continue
    const prop = propOf(option.name)
    if (prop) out[prop] = value
    else extra.push({ '@type': 'PropertyValue', name: option.name, value })
  }
  if (extra.length) out.additionalProperty = extra
  return out
}
