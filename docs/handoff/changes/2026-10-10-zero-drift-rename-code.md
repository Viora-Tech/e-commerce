# Zero Drift rename, part 1: blocks code

Branch `chore/zero-drift-rename-code`. No migration. Part 1 of the glide → zero-drift code rename
(part 2: test file names, docs and comments).

- Moved: `packages/blocks/src/sections/glide{,.tsx}` → `sections/zero-drift{,.tsx}`,
  `sections/glide-product.tsx` → `zero-drift-product.tsx`, `components/sections/glide/` →
  `components/sections/zero-drift/`, `data/glide/` → `data/zero-drift/`.
- Renamed: `GLIDE_SECTIONS` → `ZERO_DRIFT_SECTIONS`, `GLIDE_PRODUCT_SECTIONS` →
  `ZERO_DRIFT_PRODUCT_SECTIONS`, `glideSections` / `glideProductSections` →
  `zeroDriftSections` / `zeroDriftProductSections`, `GlideProps` / `GlideProductProps` /
  `GlideLoaders` → `ZeroDrift…`, `GlideCookieBanner` → `ZeroDriftCookieBanner` (admin preview and
  storefront consent manager updated). The Add panel category key `glide` → `zeroDrift` (its
  title was already "Zero Drift theme"; the key is never stored).
- Saved data: section `type` names never contained "Glide", so saved templates and My sections
  load unchanged; `test/zero-drift-types.test.ts` pins the type list. Browser storage keys move
  from `glide:` to `zero-drift:` (signup popup timing, size table units); reads fall back to the old
  key (`src/storage-keys.ts`, `test/storage-keys.test.ts`) so shoppers keep their state.
- Checked: every block's server-rendered HTML for its defaults is byte-identical before and after
  (84 types), and the Customize canvas for the home and product templates of a duplicated Waimers
  theme is pixel-identical in screenshots.
