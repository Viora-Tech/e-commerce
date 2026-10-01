/**
 * SOURCE OF TRUTH KEYWORDS: image comparison copy, before after slider, IMAGE_COMPARISON
 * WHAT:  Every default and fixed UI string of the Image comparison section (Puck key
 *        `ImageComparison`), plus its entrance timing.
 * WHY:   Defaults come from Glide's templates/index.json (instance "glass_vs_cloth": the heading)
 *        and the liquid schema (everything else; the instance's two product handles and its
 *        rotate/zoom are tuned to the owner's own mouse photos). Locales: sections.image_comparison.
 * WHERE: `components/sections/glide/image-comparison.tsx`, `sections/glide/image-comparison.tsx`.
 */
export const imageComparisonContent = {
  label: 'Image comparison',
  heading: 'Low hump or high hump? Drag to compare',
  labelBefore: 'Before',
  labelAfter: 'After',
  ariaLabel: 'Drag to compare the two images',
  fields: {
    heading: 'Heading',
    imageBefore: 'First picture (left of the handle)',
    imageAfter: 'Second picture (right of the handle)',
    productBefore: 'Or a product for the first picture (handle)',
    productAfter: 'Or a product for the second picture (handle)',
    productImage: 'Which of its pictures (1 = the first)',
    labelBefore: 'First label',
    labelAfter: 'Second label',
    fit: 'Frame',
    fitWide: 'Wide (16:10)',
    fitImage: "The first picture's own shape",
    rotate: 'Turn both pictures',
    rotateNone: 'No',
    rotateLeft: 'Quarter turn left',
    rotateRight: 'Quarter turn right',
    zoom: 'Zoom (%)',
    startPosition: 'Starting position (%)',
  },
} as const

/** Behaviour from assets/image-comparison.js. */
export const IMAGE_COMPARISON = {
  /** The divider wipes in from the left the first time the section is seen. */
  sweepMs: 900,
  /** How much of the frame must be on screen before the sweep starts. */
  sweepThreshold: 0.35,
  /** Used for "the first picture's own shape" until that picture has loaded. */
  fallbackRatio: 1.6,
} as const
