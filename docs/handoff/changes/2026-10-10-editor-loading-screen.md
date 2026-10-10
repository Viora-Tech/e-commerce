# Editor loading screen

Branch `feat/editor-loading-screen` (stacked on `feat/editor-chrome-figma`, #407).

- `apps/admin/src/components/themes/customize/editor-loading.tsx` replaces the plain
  "Connecting to your storefront" text: the editor frame as placeholders, a skeleton page
  (header, hero, product row), Motion shimmer (static under reduced motion), the store's name.
- After 20 s without the first page, or on a load error, it shows "We couldn’t reach your
  storefront" with Try again (reloads), Get help and Back to themes (`LOAD_TIMEOUT_MS`, `attempt`
  in `customize-editor.tsx`).
- English and Hindi copy (`customizeContent.loading`). Light and dark through tokens.
- Docs: developer "Theme editor" → Loading screen.
