# GST invoices: "Logo left" (`polish`) matched to its Figma frame

Branch `fix/invoice-polish-figma` (from `origin/dev`). No migration.

Compared against the owner-approved frame "Classic · Indigo · logo left L · sign right"
(admin file `YmMNC5JOimqg61sI0eFI5a`, node 965:10804), rendered with the frame's own sample data.

## What changed

- **Totals box** now has the frame's rows: Subtotal (goods, before discount), Discount (when
  there is one), Shipping (the charge, or "Free" when a shipped order has no shipping charge),
  other charges, Taxable value, then IGST or CGST + SGST/UTGST. Subtotal − Discount + charges
  equals the Total. "Total GST" now shows only on intra-state documents, where it adds the two
  halves; on inter-state ones the IGST row already is that figure, as in the frame.
  (`rupeeRows` in `polish-totals.tsx`, now exported for the test.)
- **HSN breakup** columns use the frame's fixed widths (50/62/62/62 pt) instead of stretching
  across the box (`polish-items.tsx`).
- **Customer GSTIN card** shows the GSTIN and legal name only, as the frame does; the state line
  is gone (the GSTIN starts with the state code and the place of supply is in the meta strip).
- **Signature image** box is the frame's 78 pt wide (was 118 pt), so signatures print at the
  designed size.
- **Footer** says "Computer-generated invoice" on tax invoices (other documents keep their name).
- **Inter Medium**: the frame uses Medium (500) for meta values, the seller contact line, amount
  in words, totals values and the footer. The package had no 500 weight, so those fell back to
  Regular. Added `fonts/inter/Inter-Medium.ttf` (instanced at opsz 18 / wght 500 from Google
  Fonts' Inter 4.001 variable font, same build as the existing static files; OFL) and registered
  it in `FONT_FILES`, which also serves it to the admin preview route and the traced-files list.
  Only the Polish template uses weight 500, so other templates are unchanged.

## Still different on purpose

- "Reverse charge: No" stays in the meta strip (Rule 46).
- No stamp circle (no stamp setting yet).
- Quantity prints "1 NOS" when the merchant's "Unit" field is on (it is a setting).
- Item names use the snapshot's "Title / Variant" text and the sub-line shows the SKU only; the
  frame's "Title · Variant" and "Size Free" come from data we do not store per line.
- Amount in words wording ("Ninety Six Only" vs "Ninety-Six only") and the seller address format
  come from shared code used by every template and stored in snapshots; not changed here.
- The barcode is a real Code 128 of the order number, so its width follows the value; the frame's
  bars are a drawing.

## Tests

- `packages/invoices`: `vitest run` (87 passing, two new totals tests in
  `test/polish-template.test.ts`), `bun run typecheck`, biome clean.
- `apps/admin/src/lib/traced-files.test.ts` passes with the new font.

## For the owner to check

- On localhost: Apps → GST invoices → Settings → Template and style → **Logo left**; the preview
  should show Subtotal / Shipping in the totals box and the medium-weight values.
