/** The bit of a Puck field's shape our overrides need — a subset of `Field`. */
export type FieldLike = {
  type: string
  label?: string | undefined
  objectFields?: Record<string, unknown> | undefined
  options?: readonly unknown[] | undefined
}

/** `{ url, alt }` objects are section images: pick them from the media library. */
export const isImageField = (field: FieldLike): boolean =>
  field.type === 'object' &&
  'url' in (field.objectFields ?? {}) &&
  'alt' in (field.objectFields ?? {})

/** `{ label, href }` objects are buttons and links. */
export const isLinkField = (field: FieldLike): boolean =>
  field.type === 'object' &&
  'href' in (field.objectFields ?? {}) &&
  'label' in (field.objectFields ?? {})

const RESPONSIVE_KEYS = ['mobile', 'tablet', 'desktop'] as const

/** `{ mobile, tablet, desktop }` numbers (section padding): one compact three-up row. */
export const isResponsiveNumberField = (field: FieldLike): boolean => {
  if (field.type !== 'object') return false
  const fields = field.objectFields ?? {}
  return (
    Object.keys(fields).length === RESPONSIVE_KEYS.length &&
    RESPONSIVE_KEYS.every((k) => (fields[k] as { type?: string } | undefined)?.type === 'number')
  )
}

const REQUIRED_SETTINGS_GROUPS = ['spacing', 'advanced'] as const

/**
 * The shared per-section settings object (`sectionSettingsField` in
 * `@commerce/blocks`): layout / spacing / style / advanced groups.
 */
export const isSectionSettingsField = (field: FieldLike, name = ''): boolean => {
  if (field.type !== 'object') return false
  if (name && name !== 'settings') return false
  const keys = Object.keys(field.objectFields ?? {})
  // Every kind has spacing and advanced; full sections add layout and style
  // (`sectionSettingsField` kinds in @commerce/blocks: section, bleed, flow).
  return REQUIRED_SETTINGS_GROUPS.every((k) => keys.includes(k))
}

const STYLE_GROUPS = ['spacing', 'size', 'typography', 'colour', 'corners', 'visibility'] as const

/** The per-element style panel (`elementStyleField` in `@commerce/blocks`). */
export const isElementStyleField = (field: FieldLike, name = ''): boolean => {
  if (field.type !== 'object') return false
  if (name && name.split('.').pop() !== 'style') return false
  const keys = Object.keys(field.objectFields ?? {})
  return STYLE_GROUPS.every((k) => keys.includes(k))
}

/** A theme-token-or-custom colour (`{ token, custom }`): one select, a text box for custom. */
export const isColourChoiceField = (field: FieldLike): boolean => {
  if (field.type !== 'object') return false
  const keys = Object.keys(field.objectFields ?? {})
  return keys.length === 2 && keys.includes('token') && keys.includes('custom')
}
