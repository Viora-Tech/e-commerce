import {
  ChevronDown,
  FieldGroup,
  FieldList,
  FieldRichText,
  FieldSwatch,
  FieldText,
  FieldTextarea,
  FieldToggle,
  type IconComponent,
  ImageIcon,
  LinkIcon,
  SlidersHorizontal,
} from '@commerce/ui/icons'
import { type FieldLike, isImageField, isLinkField } from './customize-field-shape'

/**
 * One glyph per Puck field type, for the right panel's field-type overrides.
 * Object fields branch by shape (image, link, or a generic group) since Puck
 * has one `object` type for all three. `FieldSwatch` is here for a future
 * colour field — nothing in this app defines `type: 'custom'` for colour yet.
 */
export function iconForField(field: FieldLike): IconComponent {
  switch (field.type) {
    case 'text':
      return FieldText
    case 'textarea':
      return FieldTextarea
    case 'number':
      return SlidersHorizontal
    case 'select':
      return ChevronDown
    case 'radio':
      return (field.options?.length ?? 0) <= 2 ? FieldToggle : SlidersHorizontal
    case 'array':
      return FieldList
    case 'custom':
      return FieldRichText
    case 'object':
      if (isImageField(field)) return ImageIcon
      if (isLinkField(field)) return LinkIcon
      return FieldGroup
    default:
      return FieldText
  }
}

export { FieldSwatch }
