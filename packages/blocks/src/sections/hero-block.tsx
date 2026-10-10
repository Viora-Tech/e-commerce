import type { ComponentConfig, Fields } from '@puckeditor/core'
import HeroCarousel from '../components/hero-carousel'
import { heroCarouselContent as copy } from '../data/zero-drift/hero-carousel'
import type { CardProduct } from '../types'
import type { Image, Link } from './framed'
import { heroFields } from './hero-fields'
import type { SingleProductLoader } from './library'

/** One slide as stored. Slides saved before the Zero Drift refresh hold only the first six keys. */
export type HeroSlideProps = {
  heading: string
  subheading?: string | undefined
  image: Image
  cta?: Link | undefined
  cta2?: Link | undefined
  textPosition?: 'left' | 'center' | 'right' | undefined
  kind?: 'image' | 'video' | undefined
  layout?: 'full_bleed' | 'split' | undefined
  splitMediaPosition?: 'left' | 'right' | undefined
  metaLabel?: string | undefined
  colorScheme?: 'dark' | 'brand' | 'light' | undefined
  mobileImage?: Image | undefined
  videoUrl?: string | undefined
  poster?: Image | undefined
  /** A product handle: its picture stands in when no picture is set, and it fills the product box. */
  product?: string | undefined
  showProductChip?: boolean | undefined
  chipStyle?: 'card' | 'inline' | 'bar' | undefined
  link?: string | undefined
  deadline?: string | undefined
}

export type HeroProps = {
  slides: HeroSlideProps[]
  frame: 'full' | 'inset'
  pin: boolean
  autoplay: boolean
  autoplayInterval: number
  showArrows: boolean
  showDots: boolean
  dotProgress: boolean
  heightMode: 'fixed' | 'viewport'
  slideHeight: number
  slideHeightMobile: number
  headingScale: number
  showSlideCounter: boolean
  scrimOpacity: number
  scrimTint: boolean
  grain: boolean
  enableZoom: boolean
  enableEntrance: boolean
  wordEntrance: boolean
  parallax: boolean
  showScrollCue: boolean
  scrollCueText: string
  lowStockThreshold: number
  /** Before the Zero Drift refresh: seconds per slide, 0 = off. Folded into `autoplay*` on resolve. */
  autoplaySeconds?: number | undefined
  /** Before the Zero Drift refresh: a fixed height in vh. Folded into `slideHeight` on resolve. */
  heightVh?: number | undefined
  /** Filled by resolveData, one entry per slide (null when it has no product or none was found). */
  resolved?: (CardProduct | null)[]
}

/** Puck's loaders for the hero: one product per slide that names a handle. */
type HeroLoaders = { loadProduct?: SingleProductLoader | undefined }

const noImage = { url: '', alt: '' }

const defaultProps: HeroProps = {
  slides: [
    {
      kind: 'image',
      layout: 'full_bleed',
      heading: copy.slide.heading,
      subheading: copy.slide.subheading,
      image: noImage,
      cta: { ...copy.slide.cta },
      textPosition: 'left',
      colorScheme: 'dark',
    },
    {
      kind: 'image',
      layout: 'split',
      splitMediaPosition: 'left',
      heading: copy.splitSlide.heading,
      subheading: copy.splitSlide.subheading,
      image: noImage,
      cta: { ...copy.splitSlide.cta },
      textPosition: 'left',
      colorScheme: 'dark',
    },
  ],
  frame: 'full',
  pin: false,
  autoplay: true,
  autoplayInterval: 5,
  showArrows: true,
  showDots: true,
  dotProgress: true,
  heightMode: 'viewport',
  slideHeight: 72,
  slideHeightMobile: 56,
  headingScale: 100,
  showSlideCounter: true,
  scrimOpacity: 45,
  scrimTint: true,
  grain: true,
  enableZoom: false,
  enableEntrance: true,
  wordEntrance: true,
  parallax: true,
  showScrollCue: true,
  scrollCueText: copy.scrollCue,
  lowStockThreshold: 5,
}

/**
 * The settings a hero saved before the Zero Drift refresh implies: `autoplaySeconds` (0 = off) and
 * a fixed `heightVh`. Undefined keys are left alone, so a hero saved since keeps its own.
 */
function legacySettings(p: HeroProps): Partial<HeroProps> {
  return {
    ...(typeof p.autoplaySeconds === 'number'
      ? {
          autoplay: p.autoplaySeconds > 0,
          autoplayInterval: p.autoplaySeconds > 0 ? p.autoplaySeconds : p.autoplayInterval,
        }
      : {}),
    ...(typeof p.heightVh === 'number' ? { heightMode: 'fixed', slideHeight: p.heightVh } : {}),
  }
}

// Port of sections/hero-carousel.liquid. The Puck key stays `Hero`: default templates and saved
// stores use it, and slides saved in the old shape keep rendering (see `HeroSlideProps`).
export function heroBlock(loaders: HeroLoaders = {}): ComponentConfig<HeroProps> {
  return {
    label: copy.label,
    fields: heroFields as unknown as Fields<HeroProps>,
    defaultProps,
    resolveData: async ({ props }) => ({
      props: {
        ...legacySettings(props),
        autoplaySeconds: undefined,
        heightVh: undefined,
        resolved: await Promise.all(
          (props.slides ?? []).map((s) =>
            s.product && loaders.loadProduct
              ? loaders.loadProduct(s.product)
              : Promise.resolve(null),
          ),
        ),
      },
      readOnly: { resolved: true },
    }),
    render: (props) => {
      const p = { ...props, ...legacySettings(props) }
      return (
        <HeroCarousel
          slides={(p.slides ?? []).map((s, i) => ({
            ...s,
            mediaSide: s.splitMediaPosition,
            scheme: s.colorScheme,
            showChip: s.showProductChip,
            product: p.resolved?.[i] ?? null,
          }))}
          autoplaySeconds={p.autoplay ? p.autoplayInterval : 0}
          heightVh={p.slideHeight}
          heightMobileVh={p.slideHeightMobile}
          heightMode={p.heightMode}
          frame={p.frame}
          pin={p.pin}
          showArrows={p.showArrows}
          showDots={p.showDots}
          dotProgress={p.dotProgress}
          headingScale={p.headingScale}
          showCounter={p.showSlideCounter}
          scrimOpacity={p.scrimOpacity}
          scrimTint={p.scrimTint}
          grain={p.grain}
          zoom={p.enableZoom}
          entrance={p.enableEntrance}
          wordEntrance={p.wordEntrance}
          parallax={p.parallax}
          scrollCue={p.showScrollCue}
          scrollCueText={p.scrollCueText}
          lowStockThreshold={p.lowStockThreshold}
        />
      )
    },
  }
}
