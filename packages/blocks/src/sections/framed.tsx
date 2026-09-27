import type { ComponentConfig, Fields } from '@puckeditor/core'
import type { ReactNode } from 'react'
import SectionFrame from '../components/section-frame'
import type { FocalPoint } from '../focal-point'
import {
  defaultSectionSettings,
  type LegacySectionProps,
  migrateSectionSettings,
  type SectionSettingsValue,
  sectionSettingsField,
} from '../section-settings'
import type { SectionMetadata } from './dynamic'

/**
 * Every section carries a `settings` object (layout/spacing/style/advanced —
 * `../section-settings.ts`), which replaces the old flat `scheme`/`padTop`/
 * `padBottom` props in the Field panel. `migrateSectionSettings` maps stored
 * legacy props onto it, so old theme docs keep rendering identically —
 * `defaultSectionSettings()` alone reproduces today's default look.
 */
export type Frame = { settings: SectionSettingsValue }
/** A section image. `focal` is optional: see `../focal-point.ts`. */
export type Image = { url: string; alt: string; focal?: FocalPoint | undefined }
/** A section link. `newTab` is optional: see `../link.ts`. */
export type Link = { label: string; href: string; newTab?: boolean | undefined }

export const SCHEMES = [
  { label: 'Default', value: 'scheme-1' },
  { label: 'Night', value: 'scheme-2' },
  { label: 'Charcoal', value: 'scheme-3' },
  { label: 'Purple', value: 'scheme-4' },
  { label: 'Mist', value: 'scheme-5' },
]

export const frame = {
  settings: sectionSettingsField(SCHEMES),
} as const
const frameDefaults: Frame = { settings: defaultSectionSettings() }

export const imageField = (label = 'Image') =>
  ({
    type: 'object',
    label,
    objectFields: {
      url: { type: 'text', label: 'Image URL' },
      alt: { type: 'text', label: 'Alt text' },
    },
  }) as const
export const linkField = (label = 'Button') =>
  ({
    type: 'object',
    label,
    objectFields: {
      label: { type: 'text', label: 'Label' },
      href: { type: 'text', label: 'Link' },
    },
  }) as const
export const noImage: Image = { url: '', alt: '' }

/**
 * A library section: its own fields plus the colour scheme and padding every
 * section shares, rendered inside the Glide section frame.
 */
export function framed<P extends Frame>(
  label: string,
  fields: Record<string, unknown>,
  defaults: Omit<P, keyof Frame>,
  body: (props: P, meta: SectionMetadata) => ReactNode,
  extra: {
    defaultProps?: P
    resolveData?: (data: { props: P }) => Promise<{ props: Partial<P>; readOnly: object }>
  } = {},
): ComponentConfig {
  return {
    label,
    fields: { ...fields, ...frame } as unknown as Fields,
    defaultProps: extra.defaultProps ?? { ...frameDefaults, ...defaults },
    render: ({ puck, ...props }) => {
      const p = props as unknown as P
      const settings = migrateSectionSettings(p as unknown as LegacySectionProps)
      return (
        <SectionFrame settings={settings}>
          {body(p, (puck?.metadata ?? {}) as SectionMetadata)}
        </SectionFrame>
      )
    },
    ...(extra.resolveData
      ? { resolveData: extra.resolveData as ComponentConfig['resolveData'] }
      : {}),
  } as ComponentConfig
}
