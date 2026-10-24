# Affiliates v1.1, PR 6: GSTIN, GST on payouts, 26Q export, PAN blocker

Branch `feat/affiliates-gst`, PR into `dev`, after PR 1 (#733, merged). Design: `docs/superpowers/specs/2026-10-24-affiliates-parity-design.md`
section 4 "GST and TDS". Owner call: add 18% GST to the payout of GST-registered affiliates, marked
"CA check" in the copy.

## Migration

`0165_affiliate_gst` (after `0164_pixels_storefront`). `affiliate.gst_registered`
boolean default false; `affiliate_payout.gst_paise` int default 0. `ADD COLUMN IF NOT EXISTS`.
The GSTIN itself goes inside the encrypted `payout_details` blob, never a column.

## Code

- `settings.ts` (store-wide): `gst { enabled, bp: 1800 }`, `requirePanAboveThreshold` (default off),
  `tds.section` (default `TDS_SECTION` = "393(1) Sl. 1(ii) / 194H", CA check).
- `affiliates.ts`: `PayoutDetailsSchema` takes an optional `gstin` (checked with
  `validateGstin`, check character included); `savePayoutDetails` sets `gst_registered`.
- `gst.ts` (new, pure): `payoutGstPaise` (bp of commission less clawbacks, registered only),
  `payoutNetPaise` = gross − clawback + GST − TDS. TDS is unchanged (ex-GST, at credit).
- `payouts.ts`: candidates carry `gstPaise`; new blocker `no_pan` (store asks, no PAN, FY credit
  over the TDS threshold); payouts store `gst_paise`; the bank CSV gains `GSTIN` and `GST (INR)`
  columns (before "Amount to pay").
- `tds.ts`: `quarterRange`, `quarterOf` (IST). `tds-report.ts` (new): `tdsReportCsv` — one row per
  commission credited in the quarter (by `approvedAt`), PAN decrypted or `PANNOTAVBL`, section,
  credit date dd-mm-yyyy, amount, rate, TDS, order, code; reversals after credit listed apart.
- API: `affiliates.payouts.tdsReport` (`settings.manage`; excluded from MCP like `exportCsv`).
  `publicAffiliate` exposes `gstRegistered`.
- Privacy erase clears `gst_registered` with the payout details (`core/privacy/anonymise.ts`).
- Admin: Payouts GST column (both tables), "TDS report (26Q)" dialog (`tds-report-dialog.tsx`);
  Settings: section label, "Hold payouts without a PAN", GST card; affiliate detail GST line.
- Storefront: optional GSTIN in the payout details form.

## Tests

`gst-rules.test.ts` (GST/net maths, v1 entry defaults, IST quarter edges) and `gst-flow.test.ts`
(GST added and in the CSV, bad GSTIN refused, `no_pan` blocker, 26Q rows with PANNOTAVBL and the
reversed section). The v1 `flow.test.ts` still passes unchanged. API: `tdsReport` is FORBIDDEN for
staff and returns the header for the owner.
