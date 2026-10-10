# Section settings on the storefront-drawn sections (B1b)

Branch `feat/builder-settings-dynamic`. No migration.

- Main sections (product, collection, page, blog, article, cart, search, not found), Related
  products and Recently viewed now offer spacing, colour scheme, show on mobile/desktop and the
  anchor (`flow` kind, `section-settings.ts`). Header and Footer offer the same without the colour
  scheme (`bleed`), since their own design sets it (the footer is always the dark band).
- `dynamic.tsx` applies them on a frame around what the storefront draws. Defaults change
  nothing (`FLOW_SETTINGS`: no padding, default scheme), and an untouched section is drawn with
  no frame at all (`isNeutralFlow`), so saved pages render exactly as before. On a sticky
  header, padding or a hidden-on-a-device setting adds that frame around it.
- Deliberate skips, listed with their reasons in `test/section-settings-coverage.test.tsx`:
  Cookie banner, Signup popup, Sticky add to cart and Mobile dock (they float over the page) and
  imported Liquid sections (their own theme's schema).
- Fix (also for #370's hero and announcement bar): the inspector only recognised the full
  four-group settings, so the smaller kinds showed as a plain object field in the Basic tab.
  `isSectionSettingsField` now accepts any settings with spacing and advanced
  (`lib/customize-field-shape.ts`, test `customize-field-shape.test.ts`), so they get the
  Section settings panel in the Advanced tab.
