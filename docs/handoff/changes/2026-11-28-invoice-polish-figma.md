# GST invoices: "Logo left" matched to Figma, plus Logo centre, Logo right and White header

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

## Second commit: the other frames in the section

Section "GST invoice templates · Polish (18 Nov)" (965:10803) holds four invoice frames and the
settings frame:

| Frame | Node | In code before | Now |
| --- | --- | --- | --- |
| Classic · Indigo · logo left L · sign right | 965:10804 | `polish` "Logo left" | fixed above |
| Classic · Teal · logo centre M · sign right | 965:11039 | no | `polish-centre` "Logo centre" |
| Classic · Maroon · logo right S · sign left | 965:11273 | no | `polish-right` "Logo right" |
| Minimal · Emerald · logo left M · sign right | 966:10803 | no (old `minimal` is a different, ruled-grid design) | `polish-minimal` "White header" |
| Settings · Look (GST invoices) | 967:10803 | partly (template cards, colour) | unchanged |

The three Classic frames differ only in colour, logo position and size, and signature side;
the Minimal frame is the same body with a white header under a 5pt accent rule, an accent logo
tile, an unfilled meta strip between hairlines and unfilled party cards.

- One template body for all four: `polish.tsx` takes a `layout` (`left`, `centre`, `right`,
  `minimal`). The header moved to `polish-band.tsx` (logo tiles L 56, M 40, S 28 from the
  frames); `MetaStrip` and `PartyCards` take `plain` for the Minimal frame; `BottomBlock` puts
  the signature under the notes, left-aligned, for Logo right, and uses the frames' signature
  heights (M 32, L 44 centred, S 22).
- `TEMPLATE_IDS` gains `polish-centre`, `polish-right`, `polish-minimal`; `TEMPLATES` and
  `documentElement` map them. The picker in Settings › Template and style lists them from
  `TEMPLATE_IDS`; copy in `apps/admin/src/data/gst-invoices.ts` (cards and per-document names).
- Hindi: the Look group (`gstInvoicesContent.settings.groups.look`) now has an overlay in
  `apps/admin/src/data/hi/gst-invoices.ts` (the rest of the settings copy still has none).
- Merchant guide line updated (`gst-invoices.mdx`).
- Not built from the Settings frame: logo size and position and signature size and position as
  separate settings, and the company stamp. Each frame is a fixed template instead.
- The old `classic` and `minimal` templates (adapted from invoicely) are unchanged so stores
  using them print as before; they are not the Figma "Classic" and "Minimal" designs.

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

- `packages/invoices`: `vitest run` (89 passing; new totals tests and tests that list and render
  the three new templates on A4 and A5), `bun run typecheck`, biome clean.
- Admin: `bun run typecheck`, and `src/lib/traced-files.test.ts`, `src/lib/i18n.test.ts` and the
  `components/apps/gst-invoices` tests pass. There is no picker test.

## For the owner to check

- On localhost: Apps → GST invoices → Settings → Template and style: **Logo left**, **Logo
  centre**, **Logo right** and **White header**; try each with and without a logo and signature.
- Whether "White header" is the right name (the Figma settings frame calls it "Minimal", which
  the older ruled-grid template already uses).
