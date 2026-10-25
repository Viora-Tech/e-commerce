# Section settings on every section (B1)

Branch `feat/builder-section-settings`. No migration.

- Every section a merchant places now offers the shared Section settings. Only two lacked them:
  the Hero carousel and the Announcement bar. Both draw their own full-bleed frame, so they
  get a new `bleed` kind of the settings (`sectionSettingsField(schemes, 'bleed')`): spacing
  (responsive padding), show on mobile/desktop and the anchor. Width, alignment, background and
  entrance motion stay theirs (the hero pins and the bar has its own colour scheme).
- `bleedFrameProps(settings)` (section-settings.ts) puts padding, visibility and the anchor on
  the section's own `.section-frame` element: the hero's frame (`HeroCarousel` `frameProps`),
  a frame around the announcement bar. Defaults keep the old look: the hero's 40px frame padding,
  the bar's none.
- `migrateSectionSettings(props, fallback)` takes the section's own default settings for docs
  saved before it had settings; the admin's `normalizeDoc` passes `defaultProps.settings`, so
  the panel shows the padding the section renders with (before, it showed the generic 48px).
- Exceptions, by design: dynamic sections (header, footer, main sections) and imported Liquid
  sections, and three overlays (Mobile dock, Signup popup, Sticky add to cart) that float over
  the page. Layout blocks and elements keep their own `style` panel.
- Test: `test/section-settings-coverage.test.tsx` (every section declares settings and applies
  them: the anchor reaches its HTML; layout/elements have `style`; the overlay list is real).
