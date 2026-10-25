# Section styles when adding a section (plan E2)

Branch `feat/section-presets`.

- `@commerce/blocks/section-presets` (`packages/blocks/src/section-presets.ts`, words in
  `src/data/section-presets.ts`): per section type, styles that are the section's own defaults
  with a few settings changed. Hero: slideshow, centred, split, video. Feature cards: 3 across,
  4 across (new 4-column option on the section), 2 across, text only. Image banner: centred,
  left, tall. Image with text and Feature checklist: picture left or right.
- Add panel: clicking a section with styles opens a "choose a style" step
  (`add-section-styles.tsx`) with a back button; the pick is inserted with fresh ids and the
  style's settings. Dragging still adds the defaults. The default template is unaffected.
- Pictures: `bun run section-previews` now also draws each style as `<Type>--<style>.webp`. It
  needs a local Chrome (puppeteer), so it was NOT run (owner rule: no browser); until it is, the
  style step shows the section's own picture or its glyph. Run it once and commit what it writes.
- Tests written (not run): `packages/blocks/test/section-presets.test.ts`; the Add panel
  component tests now cover the style step and use Rich text for the plain-add cases.
- Docs: developer "Theme editor" (Section styles), merchant "Online store" (adding sections).
