# GST app: set any numbering series' next number

Waimers' previous billing system already issued export invoice VI/EXP/26-27/001 this financial
year, so the owner wants Koomerce's exports to carry on at EXP/26-27/0002. Until now only the
domestic invoice series could be moved (Settings › Taxes & GST).

- **Action** `gstInvoices.series.setNext({ seriesId, nextNumber, gstRegistrationId? })`
  (`settings.manage`; omitted GSTIN = the store's default). Server: `setSeriesNextNumber` in
  `packages/plugin-gst-invoices/src/next-number.ts`, which reuses `setNextNumber`'s rules: never
  below `nextNumberFloor` (the last number used this FY for that GSTIN, or the never-resetting
  counter), never backwards, and the printed number must fit GST's 16 characters. An unknown
  (unsaved) series is refused with "Save the series first".
- **UI**: each series card in the GST app's Numbering series group has a "Next number" field with
  a Set button (`series-next-field.tsx`); it acts at once, not with the settings Save, because the
  counter is shared with issuing. The card's "Next: …" preview (`gstInvoices.seriesNext`) reloads
  after a set. A series added on the screen but not saved yet has the field disabled.
- Copy: `gstSeriesNextContent` in `apps/admin/src/data/gst-invoices.ts`, Hindi in
  `data/hi/gst-invoices.ts`.
- Tests: `packages/plugin-gst-invoices/test/series-next.test.ts` (exp set to 2 → next export
  EXP/26-27/0002 then 0003; below last issued refused; unknown series and too-long numbers refused).

**For Waimers**: GST app › Settings › Numbering series › Export invoices › Next number 2 › Set.
The field works on the default GSTIN only (as the preview does); a second GSTIN needs the
action's `gstRegistrationId`.
