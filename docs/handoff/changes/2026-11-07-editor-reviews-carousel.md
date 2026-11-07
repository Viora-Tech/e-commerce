# Theme editor draws the imported reviews carousel (2026-11-07)

- The Customize canvas renders imported sections from Liquid only, so the slot Judge.me's
  reviews carousel app block leaves (`data-commerce-app-block="reviews-carousel"`) was an empty
  band. `customize/canvas-app-blocks.tsx` now fills it with our Reviews carousel from
  `reviews.widgets`, as the storefront does (`liquid-reviews-carousel.tsx`). Autoplay is off
  on the canvas. The product page `reviews` slot is not drawn on the canvas yet. Fixes #1252.
