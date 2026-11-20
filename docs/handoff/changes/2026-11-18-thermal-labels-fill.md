# 4 × 6 thermal labels fill the page (18 Nov 2026)

The owner's 4 × 6 thermal printer printed our batch labels "so small". Cause: on the
**4 × 6 in thermal** paper (`thermal4x6`) each courier PDF page was fitted whole onto the
101.6 × 152.4 mm page. Delhivery's packing slip (and other couriers' A4 slips) is a big page
with the label in one part and white around it, so the whole A4 page was shrunk to under half
size and the label sat small in the middle.

## What changed

- **Trim to the drawn area (4 × 6 only).** `labelContentBounds` (new,
  `packages/core/src/shipping/label-content-bounds.ts`) reads the page's drawing instructions
  with pdf-lib (already a dependency; no renderer, no canvas, no new package) and returns the
  box that holds ink: text (font widths, or a generous 600/1000 em when a font has none),
  filled and stroked paths, images, inline images, nested form XObjects (with their Matrix
  and BBox), clipping paths. White fills/strokes (a page-size white background) and invisible
  text are not content. It over-estimates rather than cuts: an unreadable or very large page
  (over 2 M tokens) counts as the whole visible page. The reader is split to stay under the
  500-line guardrail: `label-pdf-lexer.ts` (tokens), `label-pdf-interpreter.ts` (operators),
  `label-pdf-state.ts` (graphics state, ink box), `label-pdf-fonts.ts` (glyph widths),
  `label-pdf-geometry.ts` (matrices, boxes); `label-content-bounds.ts` is the public entry.
- `trimToContent` (label-sheet-layout.ts) adds 1 mm of white around that box, keeps it inside
  the page, and keeps the whole page when nothing (or a stray mark under 20 mm both ways) was
  found.
- `mergeLabelSheet` embeds each PDF page with that box (`embedPages(pages, boxes)`), so the
  existing fit scales the **label** — up or down, shape kept, turned 90° when a landscape
  label prints larger — to the 4 × 6 page.
- 4 × 6 now has a **2 mm safe edge** (`sheetCells('thermal4x6')` is the page inset by 2 mm):
  thermal heads skip the outer millimetre and rolls drift.
- **A4 · 4 per page** and **Courier's own size** are unchanged (no trim, same cells).
- PNG/JPEG labels are not trimmed (no pixel decoding); they are fitted as before, inside the
  2 mm edge.

## Tests

- `label-sheet-layout.test.ts`: 4 × 6 cell inside the 2 mm edge; `trimsToContent` per format;
  `trimToContent` pad, page-edge clamp, fallbacks; an A4 slip's label fills 4 × 6 after the
  trim (scale ~0.47 before, ~0.96 after); a small landscape label is turned and grown.
- `label-content-bounds.test.ts` (new): box on a white A4 page, stroke width, text, image,
  form XObject scaled, white-only page is null.
- `label-sheet.test.ts`: an A4 slip merged on 4 × 6 has its label across the page.

## Open

- Delhivery's packing slip API is understood to take `pdf_size=4R` (a native 4 × 6 slip) as
  well as the default A4, but our adapter's comments and the public reference we cite do not
  document it, so it is not sent. If confirmed on the Delhivery account, `getLabel` could ask
  for 4R when the batch is 4 × 6 (a small `ShippingProvider.getLabel` option); the trim above
  works either way.
- A page with `/Rotate` is embedded unrotated, as before (pdf-lib's `embedPage` ignores it);
  the fit still turns a landscape result.
- No migration, no new dependency.
