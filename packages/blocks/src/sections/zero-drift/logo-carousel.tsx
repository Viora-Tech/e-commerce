// Port of sections/logo-carousel.liquid: Puck config for the brand logo marquee / press strip
import type { ComponentConfig } from '@puckeditor/core'
import LogoCarousel, {
  type LogoCarouselDisplay,
} from '../../components/sections/zero-drift/logo-carousel'
import { logoCarouselContent as copy } from '../../data/zero-drift/logo-carousel'
import { defaultSectionSettings } from '../../section-settings'
import type { CardCollection } from '../../types'
import { type Frame, framed, type Image, imageField, noImage } from '../framed'
import { inlineText, inlineTextarea } from '../inline-fields'
import type { ZeroDriftLoaders } from './loaders'

export type LogoCarouselProps = Frame & {
  heading: string
  display: LogoCarouselDisplay
  pressGrayscale: boolean
  logoHeight: number
  scrollSpeed: number
  pauseOnHover: boolean
  scrollReactive: boolean
  items: {
    collectionHandle: string
    image: Image
    href: string
    label: string
    quote: string
  }[]
  /** Filled by resolveData; not edited directly. */
  resolved?: CardCollection[]
}

const yesNo = [
  { label: copy.fields.yes, value: true },
  { label: copy.fields.no, value: false },
]

const defaults: Omit<LogoCarouselProps, keyof Frame> = {
  heading: copy.heading,
  display: 'tiles',
  pressGrayscale: true,
  logoHeight: 36,
  scrollSpeed: 40,
  pauseOnHover: true,
  scrollReactive: true,
  items: copy.collections.map((handle) => ({
    collectionHandle: handle,
    image: noImage,
    href: '',
    label: '',
    quote: '',
  })),
}

export function logoCarouselSection(loaders: ZeroDriftLoaders): ComponentConfig {
  return framed<LogoCarouselProps>(
    copy.label,
    {
      heading: inlineText(copy.fields.heading),
      display: {
        type: 'select',
        label: copy.fields.display,
        options: [
          { label: copy.display.tiles, value: 'tiles' },
          { label: copy.display.logos, value: 'logos' },
          { label: copy.display.press, value: 'press' },
        ],
      },
      pressGrayscale: { type: 'radio', label: copy.fields.pressGrayscale, options: yesNo },
      logoHeight: { type: 'number', label: copy.fields.logoHeight, min: 24, max: 56, step: 4 },
      scrollSpeed: { type: 'number', label: copy.fields.scrollSpeed, min: 20, max: 60, step: 5 },
      pauseOnHover: { type: 'radio', label: copy.fields.pauseOnHover, options: yesNo },
      scrollReactive: { type: 'radio', label: copy.fields.scrollReactive, options: yesNo },
      items: {
        type: 'array',
        label: copy.fields.brands,
        max: 12,
        getItemSummary: (b: { label?: string; collectionHandle?: string }) =>
          b.label || b.collectionHandle || copy.fields.brand,
        defaultItemProps: { collectionHandle: '', image: noImage, href: '', label: '', quote: '' },
        arrayFields: {
          collectionHandle: { type: 'text', label: copy.fields.collectionHandle },
          image: imageField(copy.fields.image),
          href: { type: 'text', label: copy.fields.href },
          label: { type: 'text', label: copy.fields.label },
          quote: inlineTextarea(copy.fields.quote),
        },
      },
    },
    defaults,
    (p) => (
      <LogoCarousel
        heading={p.heading}
        display={p.display}
        pressGrayscale={p.pressGrayscale}
        logoHeight={p.logoHeight}
        scrollSpeed={p.scrollSpeed}
        pauseOnHover={p.pauseOnHover}
        scrollReactive={p.scrollReactive}
        items={p.items ?? []}
        collections={p.resolved ?? []}
      />
    ),
    {
      defaultProps: {
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 48, padBottom: 48 }),
        ...defaults,
      },
      resolveData: async ({ props }) => {
        const handles = (props.items ?? []).map((i) => i.collectionHandle).filter(Boolean)
        return {
          props: {
            resolved: loaders.loadCollections ? await loaders.loadCollections(handles) : [],
          },
          readOnly: { resolved: true },
        }
      },
    },
  )
}
