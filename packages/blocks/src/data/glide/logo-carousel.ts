/**
 * SOURCE OF TRUTH KEYWORDS: logo carousel copy, brand marquee, press strip
 * WHAT:  Every default and fixed UI string of the Logo carousel section, plus the marquee
 *        motion constants ported from Glide's assets/marquee-motion.js.
 * WHY:   Defaults come from Glide's templates/index.json (instance "logos"): the brands are
 *        picked by collection handle, and their picture, name and link come from that
 *        collection. The one uploaded logo in the theme is a shopify:// image, so it is empty here.
 * WHERE: `components/sections/glide/logo-carousel*.tsx`, `sections/glide/logo-carousel.tsx`.
 */
export const logoCarouselContent = {
  label: 'Logo carousel',
  heading: 'Brands we carry',
  fallbackLabel: 'Brand',
  empty: 'Add a brand with a picture or a collection handle to fill this row.',
  collections: [
    'abyssgaming',
    'pulsar',
    'atk',
    'arbiter-studio',
    'dareu',
    'kanami',
    'owlabs',
    'claw-gears',
    'hitscan',
    'dysphoria',
    'freefall',
  ],
  display: {
    tiles: 'Brand tiles (picture and name)',
    logos: 'Logos only',
    press: 'Press strip (still, with quotes)',
  },
  fields: {
    heading: 'Heading',
    display: 'Show as',
    pressGrayscale: 'Press strip: grey logos',
    logoHeight: 'Logo height (px)',
    scrollSpeed: 'Seconds per loop (higher is slower)',
    pauseOnHover: 'Pause when hovered',
    scrollReactive: 'Speed up while the page scrolls',
    yes: 'Yes',
    no: 'No',
    brands: 'Brands',
    brand: 'Brand',
    collectionHandle: 'Collection handle (fills in picture, name and link)',
    image: 'Logo picture',
    href: 'Link',
    label: 'Name (also the screen reader label)',
    quote: 'Quote (press strip only)',
  },
} as const

/** Marquee scroll reactivity, from assets/marquee-motion.js. */
export const MARQUEE = {
  /** Ceiling on the speed boost while scrolling. */
  maxRate: 14,
  /** Pixels scrolled in one frame that earn the full boost. */
  fullVelocity: 20,
  /** Fraction of the remaining distance to the target rate closed per frame. */
  easing: 0.12,
  /** Below this distance from base speed the rate counts as settled. */
  settled: 0.01,
  /** Scroll deltas smaller than this do not decide direction. */
  directionDeadzone: 4,
  /** Rate changes smaller than this are not written to the animation. */
  writeThreshold: 0.02,
  /** Pixels past the viewport at which the track still counts as visible. */
  margin: '100px',
} as const
