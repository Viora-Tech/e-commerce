# Starter kit sections, batch 3: lookbook, email signup band, timeline, team, trust badges

Branch `feat/library-sections-3`, stacked on `feat/library-sections-2` (#379). Five new sections
for all merchants, bringing the starter kit to 20:

| Section | Category | Notes |
| --- | --- | --- |
| Lookbook (`Lookbook`) | Media | masonry wall of photos with captions, optional link per photo |
| Email signup band (`NewsletterBand`) | More | posts to the storefront's `newsletterAction` (same as Email signup) |
| Our story timeline (`Timeline`) | Text | alternating sides on desktop, one line on phones |
| Team (`TeamGrid`) | Text | photo or initials (a person glyph while the name is being typed) |
| Trust badges (`TrustBadges`) | Text | up to four icon + title + detail cells |

- Configs: `packages/blocks/src/sections/kit-story.tsx`; the row-summary helper moved into
  `kit-fields.ts` and is shared by `kit-trust.tsx`.
- All are our own layouts (no outside code), theme tokens only, inline copy, dark schemes.
- Tests (not run): new cases in `packages/blocks/test/kit-sections.test.tsx`.
- Only the new sections' pictures are committed.
- `kit-trust.tsx` is 309 lines (soft-cap warning, under the 500 hard cap).
