# Filled stars in the admin (#877)

Review ratings showed outlined stars. The admin icons are Hugeicons (Stroke Rounded), which only
has outline glyphs, and `weight="fill"` is kept for compatibility but only thickens the stroke
(`packages/ui/src/lib/icon.tsx`). So every `<StarIcon weight="fill" />` drew a thick outline.

Stars that should look filled now pass `fill="currentColor"`, which reaches the icon's `<svg>`
and fills the star path:

- `apps/admin/src/components/apps/reviews/review-stars.tsx` (every review rating: the list,
  cards, import preview, the product's reviews): rated stars are filled amber and empty ones are
  filled in muted ink. A half star is the amber star clipped to its left half over an empty one.
- `apps/admin/src/components/metaobjects/rating-input.tsx`: the chosen stars are filled.
- The primary-keyword star in `seo-keywords-card.tsx`, `seo-keyword-suggestions.tsx` and
  `bulk-write/bulk-write-review.tsx`.

The shared icon code is unchanged: `weight="fill"` elsewhere (the active sidebar item) still
means a heavier line, which suits outline icons.
