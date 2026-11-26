# GST invoices: invoice page header no longer collides with the app bar

Branch `fix/gst-invoice-header` (from `origin/dev`). Not pushed or merged. No migration.

## What was wrong

On Apps › GST invoices › an invoice ("Tax invoice INV/26-27/0745"):

- The invoice number showed twice: in the title and again as the grey line under it.
- The app bar (GSTIN pill, Export GSTR-1, the "…" menu) floats top right of every app page, and
  `AppShellActions` padded the first page header on the right to make room for it. On a detail
  page the header's first row is the back link, so the pill sat over the header's top edge and
  the padding pushed Print and Download PDF to the middle of the title row.

## Change

- `apps/admin/src/components/layout/page-header.tsx`: a header with a back link also carries
  `data-page-back`.
- `apps/admin/src/components/apps/app-shell-actions.tsx`: `makeRoom` no longer floats the app
  bar beside such a header; the page starts below the bar instead (padding-top = bar height +
  1rem), so the header keeps the full width and its actions sit at the right edge. List pages
  (no back link) keep the 26 Nov layout with the bar beside their title. The loading skeleton
  already started below the bar, so nothing jumps when the invoice loads.
- `apps/admin/src/components/apps/gst-invoices/invoice-detail.tsx`: the line under the title
  is now the invoice date and the order ("27 Nov 2026 · Order #2514"). The number's copy button
  moved to the Number field in the first card.
- `apps/admin/src/data/gst-invoices.ts`: `detail.summary` copy (no Hindi twin for this object).

This applies to every app page whose header has a back link (other apps' detail pages too).

## Check on localhost

- Admin › Apps › GST invoices › open an invoice: the app bar is its own row at the top right;
  below it "‹ All invoices", the title with the Issued chip, and Print / Download PDF at the
  right edge. No duplicate number line.
- The invoices list and the queue still show the app bar beside their title.
- A narrow window (below 48rem): unchanged, the bar sits in its own row.
