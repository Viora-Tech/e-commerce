/**
 * SOURCE OF TRUTH KEYWORDS: featured carousel copy, featured lockup, product slides
 * WHAT:  Every default and fixed UI string of the Featured carousel section, plus its motion timing.
 * WHY:   Defaults come from Zero Drift's templates/index.json (instance "featured_carousel"), the
 *        liquid schema and locales (sections.featured_carousel, products.*). The theme's seven
 *        product handles are real Zero Drift products, so slides start empty here.
 * WHERE: `components/sections/zero-drift/featured-carousel*.tsx`, `sections/zero-drift/featured-carousel.tsx`.
 */
export const featuredCarouselContent = {
  label: 'Featured carousel',
  eyebrow: '',
  heading: 'Picked for you',
  stampText: 'PRODUCT • FEATURED •',
  empty: 'Add a product handle to a slide to show it here.',
  previous: 'Previous product',
  next: 'Next product',
  goTo: 'Go to product',
  slideOf: 'of',
  shopNow: 'Shop now',
  viewFullDetails: 'View full details',
  needHelp: 'Need help?',
  helpFallback: '/pages/contact',
  share: 'Share',
  showImage: 'Show picture',
  slides: [] as { handle: string; eyebrow: string }[],
  shareTargets: [
    { label: 'WhatsApp', url: 'https://wa.me/?text=' },
    { label: 'X', url: 'https://twitter.com/intent/tweet?url=' },
    { label: 'Facebook', url: 'https://www.facebook.com/sharer/sharer.php?u=' },
    { label: 'Telegram', url: 'https://t.me/share/url?url=' },
  ],
  fields: {
    eyebrow: 'Small heading above the title',
    heading: 'Heading',
    imageSide: 'Picture side',
    left: 'Left',
    right: 'Right',
    autoplay: 'Move on by itself',
    autoplayInterval: 'Seconds per slide',
    showStamp: 'Show the spinning stamp',
    stampText: 'Stamp text',
    showShare: 'Show share links',
    showHelp: 'Show "Need help?" link',
    helpLink: 'Need help link address',
    yes: 'Yes',
    no: 'No',
    slides: 'Products',
    slide: 'Product',
    handle: 'Product handle',
    slideEyebrow: 'Small heading for this product',
  },
} as const

/** Carousel behaviour, from assets/featured-carousel.js. */
export const FEATURED_CAROUSEL = {
  /** Seconds, used when the merchant's interval is missing or below one. */
  defaultIntervalSeconds: 7,
  /** Most pictures a slide's thumbnail strip shows. */
  maxThumbs: 8,
} as const
