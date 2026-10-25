# Customize: canvas paints the theme's page colours

Branch `fix/builder-canvas-bg`. No migration.

- Puck mirrors the admin's stylesheets and `<html>` attributes into the canvas iframe, so the
  page showed the admin's body background and text (dark in a dark admin) and next-themes'
  inline `color-scheme`. Sections without their own background read dark-on-dark.
- `preview-frame.tsx` now paints html/body like the storefront's globals.css
  (`--color-bg`, `--color-ink`, `--font-body`) and keeps stripping the admin's inline
  `color-scheme`, so the canvas follows the theme and the canvas dock's light/dark only.
- Editor chrome in the canvas (toolbar, outlines) still uses the admin's tokens.
