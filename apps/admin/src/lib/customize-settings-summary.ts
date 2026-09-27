/**
 * A settings group's current values as one short line ("Normal · Center",
 * "48 / 48", "Mobile only") for its collapsed header, so a merchant can scan
 * all four section-settings groups without opening each one. Pure: reads the
 * Puck field definitions for option labels, never the DOM.
 */

type SubField = {
  type?: string
  label?: string
  options?: readonly { label: string; value: unknown }[]
  objectFields?: Record<string, SubField>
}

type Values = Record<string, unknown>

const optionLabel = (field: SubField | undefined, value: unknown): string | null =>
  field?.options?.find((o) => o.value === value)?.label ?? null

/** Mobile/tablet/desktop numbers read as one value when equal, a range when not. */
function responsiveText(value: unknown): string | null {
  const v = (value ?? {}) as Values
  const nums = ['mobile', 'tablet', 'desktop']
    .map((k) => v[k])
    .filter((n): n is number => typeof n === 'number')
  if (nums.length === 0) return null
  const lo = Math.min(...nums)
  const hi = Math.max(...nums)
  return lo === hi ? `${lo}` : `${lo}–${hi}`
}

type Summariser = (fields: Record<string, SubField>, value: Values) => string

/** First couple of plain values, with option labels — for any group without its own summariser. */
const genericSummary: Summariser = (fields, value) =>
  Object.entries(fields)
    .map(([key, field]) => {
      const v = value[key]
      if (field.options) return optionLabel(field, v)
      if (typeof v === 'number' && v !== 0) return String(v)
      if (typeof v === 'string' && v) return v.length > 18 ? `${v.slice(0, 17)}…` : v
      return null
    })
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ')

const SUMMARISERS: Record<string, Summariser> = {
  layout: (fields, v) =>
    [optionLabel(fields.contentWidth, v.contentWidth), optionLabel(fields.alignment, v.alignment)]
      .filter(Boolean)
      .join(' · '),
  spacing: (fields, v) => {
    // Element style spacing (margins and inner space) reads like any other group.
    if (!('paddingTop' in fields)) return genericSummary(fields, v)
    const top = responsiveText(v.paddingTop)
    const bottom = responsiveText(v.paddingBottom)
    return top && bottom ? `${top} / ${bottom}` : ''
  },
  visibility: (_fields, v) => {
    const on = (['mobile', 'tablet', 'desktop'] as const).filter((k) => v[k] !== false)
    if (on.length === 3) return 'Everywhere'
    if (on.length === 0) return 'Hidden'
    const names = { mobile: 'Phones', tablet: 'Tablets', desktop: 'Computers' }
    return on.map((k) => names[k]).join(' · ')
  },
  colour: (_fields, v) =>
    ['text', 'background']
      .map((k) => {
        const token = ((v[k] ?? {}) as Values).token
        return token && token !== 'inherit' ? (k === 'text' ? 'Text' : 'Background') : null
      })
      .filter(Boolean)
      .join(' · '),
  style: (fields, v) => {
    const image = (v.backgroundImage ?? {}) as Values
    return [
      optionLabel(fields.colorScheme, v.colorScheme),
      typeof image.url === 'string' && image.url ? 'Image' : null,
      typeof v.backgroundColor === 'string' && v.backgroundColor ? 'Colour' : null,
    ]
      .filter(Boolean)
      .join(' · ')
  },
  advanced: (fields, v) => {
    const mobile = v.showOnMobile !== false
    const desktop = v.showOnDesktop !== false
    const visibility =
      mobile && desktop
        ? 'Everywhere'
        : mobile
          ? 'Mobile only'
          : desktop
            ? 'Desktop only'
            : 'Hidden'
    const animation =
      v.entranceAnimation && v.entranceAnimation !== 'none'
        ? optionLabel(fields.entranceAnimation, v.entranceAnimation)
        : null
    return [visibility, animation].filter(Boolean).join(' · ')
  },
}

export function settingsGroupSummary(
  group: string,
  fields: Record<string, SubField>,
  value: Values,
): string {
  return (SUMMARISERS[group] ?? genericSummary)(fields, value)
}
