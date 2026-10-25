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
import type { MediaImage } from '../types'
import type { SectionMetadata } from './dynamic'
import { inlineText } from './inline-fields'

/**
 * Every section carries a `settings` object (layout/spacing/style/advanced —
 * `../section-settings.ts`), which replaces the old flat `scheme`/`padTop`/
 * `padBottom` props in the Field panel. `migrateSectionSettings` maps stored
 * legacy props onto it, so old theme docs keep rendering identically —
 * `defaultSectionSettings()` alone reproduces today's default look.
 */
export type Frame = { settings: SectionSettingsValue }
/** A section image. `focal` is optional: see `../focal-point.ts`. */
export type Image = {
  url: string
  alt: string
  focal?: FocalPoint | undefined
  /**
   * Never saved by the editor: the storefront looks the URL up in the media library at
   * render time (`attachImageMedia`) so `<Picture>` can serve AVIF/WebP and a ThumbHash.
   */
  variants?: MediaImage['variants']
  thumbhash?: MediaImage['thumbhash']
}
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
/**
 * A button whose label the merchant can also type into on the canvas: the label arrives as a
 * React node while editing, so only use it where the label is drawn, never as an aria-label.
 */
export const inlineLinkField = (label = 'Button') =>
  ({
    type: 'object',
    label,
    objectFields: {
      label: inlineText('Label'),
      href: { type: 'text', label: 'Link' },
    },
  }) as const
export const noImage: Image = { url: '', alt: '' }

/**
 * A library section: its own fields plus the colour scheme and padding every
 * section shares, rendered inside the Zero Drift section frame.
 */
export function framed<P extends Frame>(
  label: string,
  fields: Record<string, unknown>,
  defaults: Omit<P, keyof Frame>,
  /** `editing` is true on the Customize canvas, where collapsed copy has to be reachable. */
  body: (props: P, meta: SectionMetadata, editing: boolean) => ReactNode,
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
          {body(p, (puck?.metadata ?? {}) as SectionMetadata, puck?.isEditing === true)}
        </SectionFrame>
      )
    },
    ...(extra.resolveData
      ? { resolveData: extra.resolveData as ComponentConfig['resolveData'] }
      : {}),
  } as ComponentConfig
}
