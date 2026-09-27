import type { ComponentConfig, Fields } from '@puckeditor/core'
import { customSectionsContent as copy } from '../data/custom-sections'
import { defaultElementStyle, elementStyleField } from '../element-style'
import { DYNAMIC_SECTIONS } from './dynamic'

/**
 * Field builders shared by the build-your-own blocks (`./custom-layout.tsx`,
 * `./custom-elements.tsx`). Every block gets the `style` panel.
 */
export const f = copy.fields
export const labels = copy.labels

/**
 * What a slot never takes: the page's main sections and the header and
 * footer, which the template places once. Everything else, containers
 * included, nests anywhere.
 */
export const SLOT_DISALLOW: string[] = DYNAMIC_SECTIONS.filter(
  (t) => t !== 'RelatedProducts' && t !== 'RecentlyViewed',
)

export const slot = (label: string) => ({ type: 'slot', label, disallow: SLOT_DISALLOW }) as const

export const yesNo = (label: string, yes: string = f.yes, no: string = f.no) =>
  ({
    type: 'radio',
    label,
    options: [
      { label: yes, value: true },
      { label: no, value: false },
    ],
  }) as const

export const px = (label: string, max = 160) => ({ type: 'number', label, min: 0, max }) as const

export const colourChoice = (label: string) =>
  ({
    type: 'object',
    label,
    objectFields: {
      token: elementStyleField.objectFields.colour.objectFields.text.objectFields.token,
      custom: { type: 'text', label: 'Custom colour' },
    },
  }) as const

export const responsive = (label: string, max: number) =>
  ({
    type: 'object',
    label,
    objectFields: {
      mobile: { type: 'number', label: f.mobile, min: 0, max },
      tablet: { type: 'number', label: f.tablet, min: 0, max },
      desktop: { type: 'number', label: f.desktop, min: 0, max },
    },
  }) as const

export const align = {
  type: 'select',
  label: f.align,
  options: [
    { label: f.start, value: 'start' },
    { label: f.center, value: 'center' },
    { label: f.end, value: 'end' },
    { label: f.stretch, value: 'stretch' },
  ],
} as const

export type RenderArgs = Record<string, unknown> & { puck?: { isEditing?: boolean } }

/** A block config: its fields plus the `style` panel, its defaults plus the default style. */
export const component = (
  label: string,
  fields: Record<string, unknown>,
  defaultProps: Record<string, unknown>,
  render: (props: RenderArgs) => React.ReactNode,
  extra: Partial<ComponentConfig> = {},
): ComponentConfig =>
  ({
    label,
    fields: { ...fields, style: elementStyleField } as unknown as Fields,
    defaultProps: { ...defaultProps, style: defaultElementStyle() },
    render,
    ...extra,
  }) as ComponentConfig
