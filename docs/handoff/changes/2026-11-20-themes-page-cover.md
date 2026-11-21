# Themes page: hero cover instead of the swatch (20 Nov 2026)

Branch `fix/themes-page-picture` (from `dev`).

## Why the live theme showed the colour swatch

- Customize takes the Themes picture only on a saved home page (`onSavedHome` in
  `customize-editor.tsx`). An imported theme with unsaved home/footer drafts never qualifies.
- The worker's headless screenshot (queued by `themes.list` for a live theme with no picture)
  needs `apps/worker` running with Chromium; on localhost it usually is not.
- Nothing else stood between "no picture" and the swatch.

## Change

- `@commerce/core` `templateCover` (`theme/template-cover.ts`) + `themeCovers(tx)`: the first
  picture of each theme's SAVED home page (a hero video's poster first, else an image), from
  the first three sections. Drafts are never read.
- `themes.list` / every presented theme carries `cover`. The Themes card and library rows show
  screenshot → cover → swatch (swatch last).
- `comparableTemplate` (`templates-data.ts`): Save's "is this draft an edit?" check treats an
  empty `zones: {}` as none. The editor always sends `zones: {}` and imported sections have
  none, so undoing an edit left a phantom draft and "Unsaved changes" stayed on.
- Copy: `library.coverHint` (English and Hindi).
