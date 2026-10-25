import type { Overrides } from '@puckeditor/core'
import type { ComponentProps, ComponentType } from 'react'
import BlockToolbar from '@/components/themes/customize/block-toolbar'
import BlockToolbarFormat from '@/components/themes/customize/block-toolbar-format'
import CustomizeArrayField from '@/components/themes/customize/customize-array-field'
import CustomizeNumberField from '@/components/themes/customize/customize-number-field'
import CustomizeObjectField from '@/components/themes/customize/customize-object-field'
import CustomizeRadioField from '@/components/themes/customize/customize-radio-field'
import CustomizeRichTextField from '@/components/themes/customize/customize-richtext-field'
import CustomizeSelectField from '@/components/themes/customize/customize-select-field'
import CustomizeTextField from '@/components/themes/customize/customize-text-field'
import InspectorFields from '@/components/themes/customize/inspector-fields'
import PreviewFrame from '@/components/themes/customize/preview-frame'
import { withDynamicSources } from '@/lib/customize-dynamic-fields'

/** The props a field override component expects, for narrowing Puck's wide field props. */
// biome-ignore lint/suspicious/noExplicitAny: matches React's own ComponentProps constraint.
type FieldOverride<C extends ComponentType<any>> = ComponentProps<C>

/**
 * Puck's UI overrides. Module-level on purpose: Puck treats each override as a
 * component type, so a new function on every editor render (as inline
 * closures over `settings`/`mode` were) made React unmount and remount the
 * whole canvas — the flicker the first edit after a save caused. Anything an
 * override needs from the editor comes through context instead.
 */
export const CUSTOMIZE_OVERRIDES: Partial<Overrides> = {
  iframe: ({ children, document }) => <PreviewFrame document={document}>{children}</PreviewFrame>,
  // One toolbar per selected block: BlockToolbar draws it in Puck's overlay, and Puck's
  // action bar only hands its inline rich-text menu over to it (BlockToolbarFormat).
  componentOverlay: (props) => <BlockToolbar {...props} />,
  actionBar: ({ children }) => <BlockToolbarFormat>{children}</BlockToolbarFormat>,
  // Puck's own field label can't tell field types apart (it only gets the label
  // text), so it's suppressed here: every fieldTypes override below renders its
  // own icon + label through FieldFrame instead.
  // Puck types `field` as a wide union (every field type plus custom ones); each
  // override is only ever called for its own type, so narrow it to what it reads.
  fieldLabel: () => <></>,
  // Basic / Advanced: filters the selected section's fields by name (see InspectorFields).
  fields: ({ children }) => <InspectorFields>{children}</InspectorFields>,
  // Every setting gets the "connect dynamic source" control (see ./customize-dynamic-fields).
  fieldTypes: withDynamicSources({
    text: (props) => (
      <CustomizeTextField {...(props as FieldOverride<typeof CustomizeTextField>)} />
    ),
    textarea: (props) => (
      <CustomizeTextField {...(props as FieldOverride<typeof CustomizeTextField>)} />
    ),
    number: (props) => (
      <CustomizeNumberField {...(props as FieldOverride<typeof CustomizeNumberField>)} />
    ),
    select: (props) => (
      <CustomizeSelectField {...(props as FieldOverride<typeof CustomizeSelectField>)} />
    ),
    radio: (props) => (
      <CustomizeRadioField {...(props as FieldOverride<typeof CustomizeRadioField>)} />
    ),
    array: (props) => (
      <CustomizeArrayField {...(props as FieldOverride<typeof CustomizeArrayField>)} />
    ),
    object: (props) => (
      <CustomizeObjectField {...(props as FieldOverride<typeof CustomizeObjectField>)} />
    ),
    // Puck's own Tiptap editor for `richtext` body copy (inline editing on the canvas too).
    richtext: (props) => (
      <CustomizeRichTextField {...(props as FieldOverride<typeof CustomizeRichTextField>)} />
    ),
    custom: (props: {
      field: unknown
      value: unknown
      onChange: (v: unknown) => void
      name: string
    }) => (
      <CustomizeRichTextField
        {...(props as unknown as FieldOverride<typeof CustomizeRichTextField>)}
      />
    ),
  }),
}
