import { heroCarouselContent as copy } from '../data/zero-drift/hero-carousel'
import { imageField, linkField } from './framed'
import { inlineText } from './inline-fields'

const f = copy.fields

const yesNo = (label: string) =>
  ({
    type: 'radio',
    label,
    options: [
      { label: f.yes, value: true },
      { label: f.no, value: false },
    ],
  }) as const

const range = (label: string, min: number, max: number, step = 1) =>
  ({ type: 'number', label, min, max, step }) as const

/**
 * The Puck fields of the `Hero` section, mirroring sections/hero-carousel.liquid's schema.
 * Glide has two block types (image_slide, video_slide); Puck arrays have one item shape, so
 * every slide carries both and `kind` picks which media it plays.
 */
export const heroFields = {
  slides: {
    type: 'array',
    label: f.slides,
    getItemSummary: (s: { heading?: unknown }) =>
      typeof s.heading === 'string' && s.heading ? s.heading : f.slide,
    defaultItemProps: {
      kind: 'image',
      layout: 'full_bleed',
      heading: '',
      image: { url: '', alt: '' },
      textPosition: 'left',
    },
    arrayFields: {
      kind: {
        type: 'radio',
        label: f.kind,
        options: [
          { label: f.image, value: 'image' },
          { label: f.video, value: 'video' },
        ],
      },
      heading: inlineText(f.heading),
      subheading: inlineText(f.subheading),
      metaLabel: inlineText(f.metaLabel),
      image: imageField(f.picture),
      mobileImage: imageField(f.mobilePicture),
      videoUrl: { type: 'text', label: f.videoUrl },
      poster: imageField(f.poster),
      cta: linkField(f.cta),
      cta2: linkField(f.cta2),
      textPosition: {
        type: 'radio',
        label: f.textPosition,
        options: [
          { label: f.left, value: 'left' },
          { label: f.center, value: 'center' },
          { label: f.right, value: 'right' },
        ],
      },
      layout: {
        type: 'radio',
        label: f.layout,
        options: [
          { label: f.fullBleed, value: 'full_bleed' },
          { label: f.split, value: 'split' },
        ],
      },
      splitMediaPosition: {
        type: 'radio',
        label: f.mediaSide,
        options: [
          { label: f.left, value: 'left' },
          { label: f.right, value: 'right' },
        ],
      },
      colorScheme: {
        type: 'select',
        label: f.scheme,
        options: [
          { label: f.dark, value: 'dark' },
          { label: f.brand, value: 'brand' },
          { label: f.light, value: 'light' },
        ],
      },
      product: { type: 'text', label: f.product },
      showProductChip: yesNo(f.showChip),
      chipStyle: {
        type: 'select',
        label: f.chipStyle,
        options: [
          { label: f.chipCard, value: 'card' },
          { label: f.chipInline, value: 'inline' },
          { label: f.chipBar, value: 'bar' },
        ],
      },
      link: { type: 'text', label: f.link },
      deadline: { type: 'text', label: f.deadline },
    },
  },
  frame: {
    type: 'radio',
    label: f.frame,
    options: [
      { label: f.frameFull, value: 'full' },
      { label: f.frameInset, value: 'inset' },
    ],
  },
  pin: yesNo(f.pin),
  autoplay: yesNo(f.autoplay),
  autoplayInterval: range(f.autoplayInterval, 3, 10),
  showArrows: yesNo(f.showArrows),
  showDots: yesNo(f.showDots),
  dotProgress: yesNo(f.dotProgress),
  heightMode: {
    type: 'radio',
    label: f.heightMode,
    options: [
      { label: f.heightFixed, value: 'fixed' },
      { label: f.heightViewport, value: 'viewport' },
    ],
  },
  slideHeight: range(f.slideHeight, 40, 90, 2),
  slideHeightMobile: range(f.slideHeightMobile, 30, 80, 2),
  headingScale: range(f.headingScale, 80, 140, 5),
  showSlideCounter: yesNo(f.showSlideCounter),
  scrimOpacity: range(f.scrimOpacity, 0, 70, 5),
  scrimTint: yesNo(f.scrimTint),
  grain: yesNo(f.grain),
  enableZoom: yesNo(f.enableZoom),
  enableEntrance: yesNo(f.enableEntrance),
  wordEntrance: yesNo(f.wordEntrance),
  parallax: yesNo(f.parallax),
  showScrollCue: yesNo(f.showScrollCue),
  scrollCueText: inlineText(f.scrollCueText),
  // Number of products left at or under which the product box says "Low stock".
  lowStockThreshold: range(f.lowStockThreshold, 1, 20),
}
