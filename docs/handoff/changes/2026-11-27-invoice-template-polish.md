# GST invoices: new "Logo left" template (`polish`)

Branch `feat/invoice-template-polish` (from `origin/dev`). No migration.

## What changed

- New PDF template id `polish`, labelled **Logo left**, built from the owner-approved Figma frame
  "Classic · Indigo · logo left L · sign right" (admin file `YmMNC5JOimqg61sI0eFI5a`, page Apps,
  section "GST invoice templates · Polish (18 Nov)", node 965:10804). Classic stays the default;
  Classic, Minimal and GST compact are unchanged.
- Layout: full-bleed accent band (logo tile left, seller name, address, GSTIN and email; title,
  number and "Original for recipient" right), tinted meta strip with the Code 128 barcode, left-ruled
  Bill to / Ship to / Customer GSTIN cards, tinted item table (rupee amounts), HSN-wise breakup
  (IGST or CGST + SGST), amount in words, reason, terms and notes, a tinted totals box with Taxable
  value, each tax, Total GST and an accent Total bar, right-aligned signature, ruled footer with the
  store footer text and "Page x of y". All fills are tints of the store accent colour
  (`palette()` reproduces the Figma indigo tints exactly). Works for every document type (tax
  invoice, bill of supply, credit note, vouchers, slips) and A4/A5.
- Files: `packages/invoices/src/templates/polish.tsx` (page), `polish-head.tsx` (band, meta
  strip, party cards), `polish-items.tsx` (item and HSN tables), `polish-totals.tsx` (bottom
  block, signature), `polish-style.ts` (colours, tints, initials). `TEMPLATE_IDS` in
  `packages/invoices/src/settings.ts`, `TEMPLATES` and `documentElement` in `templates/index.tsx`.
  `Barcode` in `parts.tsx` gained an optional `textStyle` (defaults unchanged).
- Admin: `apps/admin/src/data/gst-invoices.ts` (template card and per-document template name);
  the template cards in `look-group.tsx` now sit two per row so four cards fit. The settings copy
  has no Hindi overlay yet, so none was added. Merchant guide line updated in
  `apps/docs/content/merchant-guide/money-and-gst/gst-invoices.mdx`.

## Deliberate differences from the Figma frame

- "Reverse charge: No" stays in the meta strip (Rule 46), and the strip wraps when a credit note
  adds "Against invoice".
- No company stamp circle: there is no stamp setting yet (the Figma Settings frame shows "Add
  company stamp (optional)"). Logo size/position and signature size/position options from that
  Settings frame are not built; this template is the fixed logo-left / sign-right variant.
- Without a logo the tile shows the seller's initials ("S&S"), as the frame's placeholder does.
- Pages after the first start without a top margin (the band is only on page 1).

## Tests

- `packages/invoices/test/polish-template.test.ts`: palette tints, key text for tax invoice,
  credit note and intra-state CGST/SGST, meta strip labels, and a PDF render of every document
  type on A4 and A5. Run together with `preview-render.test.ts` and the rest of the invoices suite
  (85 passing) plus `tsc --noEmit` on the package, outside this worktree (no node_modules here).
- Admin typecheck not run.

## Left to do / for the owner to check

- On localhost: Apps → GST invoices → Settings → Template and style → **Logo left**, with the
  store logo, signature and Waimers accent; print a long order to see page 2.
