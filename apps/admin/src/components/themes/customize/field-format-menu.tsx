'use client'

import type { RichtextField } from '@puckeditor/core'
import InlineFormatMenu from './inline-format-menu'

type FieldFormatMenuProps = Parameters<NonNullable<RichtextField['renderMenu']>>[0]

/**
 * The rich-text menu above a text field in the right panel (`renderMenu`): the canvas menu's
 * buttons plus lists, quote, rule and headings where the field allows them, all in Hugeicons
 * glyphs instead of Puck's built-in icons.
 */
export default function FieldFormatMenu(props: FieldFormatMenuProps) {
  // Render logic
  return <InlineFormatMenu {...props} set="full" />
}
