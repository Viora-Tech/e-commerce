# No dangling comma in imported footers (#1572)

- `normalizeLiquid` (`packages/core/src/theme-import/bundle.ts`) now drops a comma that sits right
  before `{{ powered_by_link }}`. That output is empty on Koomerce, so Shopify themes' copyright
  line read "© 2026 Claw Gears,".
- Applied when a theme bundle is built; the stored theme files are not changed.
- Test in `shop-policies.test.ts`; other commas are untouched.
