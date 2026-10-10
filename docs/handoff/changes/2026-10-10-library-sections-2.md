# Starter kit sections, batch 2: features, testimonials, FAQ, comparison, plans

Branch `feat/library-sections-2`, stacked on `feat/library-sections-1` (#375). Eight new
sections for all merchants, in the Add panel with pictures:

| Section | Category | Built on |
| --- | --- | --- |
| Feature cards (`FeatureCards`) | Text | Magic UI Magic Card (adapted, gradient mode) |
| How it works (`FeatureSteps`) | Text | our own layout |
| Features with image (`FeatureChecklist`) | Banners | our own layout |
| Testimonial wall (`TestimonialGrid`) | Text | our own layout |
| Quote spotlight (`TestimonialSpotlight`) | Text | our own layout |
| FAQ with contact (`FaqSplit`) | Text | our own layout, native `<details>` |
| Comparison table (`ComparisonTable`) | Text | our own layout |
| Plans and bundles (`PricingCards`) | Text | Magic UI Border Beam on the highlighted plan |

- Code: `packages/blocks/src/sections/kit-trust.tsx` (configs), `kit-fields.ts` (shared field
  helpers, split out so no file passes 500 lines), components in
  `src/components/sections/kit/`, new effect `src/effects/magic-card.tsx`.
- Accessibility: ticks and stars carry words for screen readers ("Included", "4 out of 5
  stars"); FAQ answers are native `<details>` (open on the Customize canvas so they can be edited).
- Credits updated in `THIRD_PARTY_NOTICES.md` and `packages/blocks/THIRD_PARTY_LICENSES.md`.
- Tests (not run): new cases in `packages/blocks/test/kit-sections.test.tsx`.
- Only the new sections' pictures are committed; existing ones were left as they were.
