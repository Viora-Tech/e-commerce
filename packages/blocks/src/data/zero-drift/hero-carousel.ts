/**
 * SOURCE OF TRUTH KEYWORDS: hero carousel copy, hero slides, hero defaults, HERO_CAROUSEL
 * WHAT:  Every default and fixed UI string of the Hero carousel section (Puck key `Hero`),
 *        plus the carousel's timing constants.
 * WHY:   Defaults come from Zero Drift's templates/index.json (instance "hero"), the liquid schema
 *        and locales (sections.hero, general.slider, products.card, general.countdown). The
 *        theme's own slides are videos from Shopify files, which do not exist here, so the
 *        default slides are the theme's two typographic slides instead.
 * WHERE: `components/hero-*.tsx`, `sections/hero-block.tsx`, `sections/hero-fields.ts`.
 */
export const heroCarouselContent = {
  label: 'Hero carousel',
  scrollCue: 'Scroll',
  previous: 'Previous slide',
  next: 'Next slide',
  goTo: (index: number) => `Go to slide ${index}`,
  counter: (current: string, total: string) => `${current} / ${total}`,
  inStock: 'In stock',
  lowStock: 'Low stock',
  soldOut: 'Sold out',
  barCta: 'Shop',
  chipCta: 'Shop now',
  countdown: { label: 'Time left', days: 'Days', hours: 'Hrs', minutes: 'Min', seconds: 'Sec' },
  slide: {
    heading: 'Move faster',
    subheading: "India's glasspad specialist.",
    cta: { label: 'Shop now', href: '/collections/all' },
  },
  splitSlide: {
    heading: 'GLASSPADS IN STOCK',
    subheading: 'The fastest surface we sell, ready to ship from India.',
    cta: { label: 'Shop glasspads', href: '/collections/glass-mousepads' },
  },
  fields: {
    slides: 'Slides',
    slide: 'Slide',
    kind: 'Slide type',
    image: 'Picture',
    video: 'Video',
    layout: 'Slide layout',
    fullBleed: 'Picture fills the slide',
    split: 'Text and picture side by side',
    mediaSide: 'Picture side (side-by-side layout)',
    left: 'Left',
    center: 'Center',
    right: 'Right',
    metaLabel: 'Slide label (shown beside the counter)',
    scheme: 'Text panel colour',
    dark: 'Dark',
    brand: 'Brand',
    light: 'Light',
    picture: 'Picture',
    mobilePicture: 'Picture on phones (optional)',
    videoUrl: 'Video address (.mp4 link)',
    poster: 'Picture shown while the video loads',
    product: 'Product handle (optional)',
    showChip: 'Show the product box',
    chipStyle: 'Product box style',
    chipCard: 'Card',
    chipInline: 'Inline',
    chipBar: 'Bar along the bottom (for video)',
    heading: 'Heading',
    subheading: 'Subheading',
    cta: 'First button',
    cta2: 'Second button',
    textPosition: 'Text position',
    link: 'Whole-slide link (when there are no buttons)',
    deadline: 'Countdown ends (date and time, e.g. 2026-09-01T00:00:00+05:30)',
    frame: 'Frame',
    frameFull: 'Full width',
    frameInset: 'Inset card with peek',
    pin: 'Pin the hero while the page slides over it',
    autoplay: 'Move to the next slide by itself',
    autoplayInterval: 'Seconds per slide',
    showArrows: 'Show arrows',
    showDots: 'Show dots',
    dotProgress: 'Fill the dots as the timer runs',
    heightMode: 'Height',
    heightFixed: 'Share of the screen',
    heightViewport: 'Fill the screen',
    slideHeight: 'Slide height (% of the screen)',
    slideHeightMobile: 'Slide height on phones (% of the screen)',
    headingScale: 'Headline size (%)',
    showSlideCounter: 'Show slide counter',
    scrimOpacity: 'Picture shading (%)',
    scrimTint: 'Tint the shading with the brand colour',
    grain: 'Film grain over pictures',
    enableZoom: 'Slow zoom on pictures',
    enableEntrance: 'Animate text in on each slide',
    wordEntrance: 'Animate the headline word by word',
    parallax: 'Pointer parallax on pictures',
    showScrollCue: 'Show scroll cue',
    scrollCueText: 'Scroll cue text',
    lowStockThreshold: 'Low stock below',
    yes: 'Yes',
    no: 'No',
  },
} as const

/** Behaviour from assets/hero-carousel.js; seconds for Motion, milliseconds for timers. */
export const HERO_CAROUSEL = {
  /** Per-word delay inside the headline entrance. */
  wordStep: 0.06,
  /** Words rise this share of an em. */
  wordRiseEm: 0.42,
  /** The loop clone hands back to slide one after this, if `scrollend` never fires. */
  loopResetMs: 900,
  /** The pinned hero is released once the next section covers it by this much. */
  pinReleasePx: 30,
  /** "Fill the screen" never makes the hero shorter than this share of the viewport. */
  viewportFloor: 0.5,
} as const
