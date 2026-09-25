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
