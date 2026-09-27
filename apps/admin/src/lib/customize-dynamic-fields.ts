import { type ComponentType, createElement, type ReactNode } from 'react'
import DynamicSourceField from '@/components/themes/customize/dynamic-source-field'
import type { FieldLike } from './customize-field-shape'

type FieldProps = {
  field: FieldLike
  name: string
  value: unknown
  onChange: (value: unknown) => void
  readOnly?: boolean | undefined
}

// biome-ignore lint/suspicious/noExplicitAny: Puck's field override props are a wide union.
type Overrides = Record<string, (props: any) => ReactNode>

/**
 * Puck `fieldTypes` overrides, each wrapped in DynamicSourceField so every
 * connectable setting (text, rich text, image, link, number, colour) gets the
 * "Connect dynamic source" button. Kept out of the editor so the wiring there is
 * one call: `fieldTypes: withDynamicSources({ ... })`.
 */
export function withDynamicSources<T extends Overrides>(overrides: T): T {
  const wrapped: Overrides = {}
  for (const [type, render] of Object.entries(overrides)) {
    wrapped[type] = (props: FieldProps) =>
      createElement(
        DynamicSourceField as ComponentType<FieldProps & { children?: ReactNode }>,
        props,
        render(props),
      )
  }
  return wrapped as T
}
