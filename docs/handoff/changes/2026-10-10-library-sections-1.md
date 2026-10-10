# Starter kit sections, batch 1: heroes, logos, stats, calls to action

Branch `feat/library-sections-1`. Seven new sections for all merchants, in the Add panel with
pictures:

| Section | Category | Built on |
| --- | --- | --- |
| Grid hero (`GridHero`) | Banners | Magic UI Retro Grid (CSS version, adapted) |
| Rotating words hero (`RotatingHero`) | Banners | Magic UI Word Rotate (adapted), Avatar Circles pattern |
| Showcase hero (`ShowcaseHero`) | Banners | Magic UI Border Beam (adapted) |
| Call to action card (`CtaCard`) | Banners | Magic UI Border Beam |
| Call to action with image (`CtaSplit`) | Banners | our own layout |
| Stat cards (`StatsCards`) | Text | Magic UI Number Ticker (now one shared effect, also used by `StatsCounter`) |
| Logo cloud (`LogoCloud`) | Media | our own layout |

- Code: `packages/blocks/src/sections/kit.tsx`, `src/components/sections/kit/*`, effects in
  `src/effects/` (`retro-grid`, `border-beam`, `word-rotate`, `number-ticker`), copy in
  `src/data/kit-sections.ts`. No Aceternity Pro, no shadcnblocks code.
- Every section: inline-editable copy, shared section settings, theme tokens only, phone layout,
  dark schemes, reduced motion (effects stand still or disappear).
- Admin: descriptions, glyphs, kinds; pictures regenerated (`bun run section-previews`, which
  also gained `--serve` to look at every section in a browser).
- Credits: `THIRD_PARTY_NOTICES.md`, `packages/blocks/THIRD_PARTY_LICENSES.md`, Add panel "by Magic UI".
- Tests (not run): `packages/blocks/test/kit-sections.test.tsx`; the kit joins
  `library-inline.test.tsx`.
- Found while checking, not fixed here: the Customize canvas page background does not follow
  the theme's `--color-bg` (white in a light admin, dark in a dark admin), so any section that
  relies on the page colour (scheme 1, no own background) reads wrong in a dark admin.
