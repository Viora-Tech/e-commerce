# GST app: monthly sales register (Excel) for the CA

The owner sends the CA a hand-made Excel sales register every month (October's:
`sales_register_october.xlsx`, tabs "Sales Register" with 16 columns, one row per invoice line,
freight its own row under SAC 996819, and "Service Register"). The GST app now writes it.

- **Download**: Returns tab › GSTR-1 card › "Sales register (Excel)" (picked month and GSTIN),
  and the app bar's "Export GSTR-1" menu (last month / this month so far, main GSTIN).
- **Action**: `gstInvoices.returns.salesRegister({ period: '2026-10', gstRegistrationId? })`,
  `orders.read` like the other return downloads, listed as a read for MCP.
- **Code**: data in `packages/plugin-gst-invoices/src/sales-register.ts` (`salesRegister`), the
  workbook in `sales-register-xlsx.ts` (`salesRegisterXlsx`, headers exported as constants).
  Library: write-excel-file 4.1.1 (MIT; only dependency fflate, already ours), credited in
  `THIRD_PARTY_NOTICES.md` and on the radar.
- **Tabs**
  1. Goods: the CA's 16 columns in their order and header look (bold, `#D9E1F2`, centred,
     frozen), dates as real dates `dd-mmm-yyyy`, rates `0%`, amounts numbers `#,##0.00` (no
     text zeros), and a TOTAL row. Column I is relabelled "LINE TOTAL (TAXABLE + GST)" (their
     file called it total invoice value) and a 17th column "INVOICE TOTAL" is filled on each
     invoice's first row only, so its sum is the sum of invoices. Domestic goods only.
  2. Service: their Service Register (S.No, no audit notes) plus INVOICE TOTAL. An invoice is a
     service invoice when every goods line has a SAC (HSN starting 99).
  3. International: export invoices; Goods columns plus country, currency, exchange rate, LUT
     number (snapshot, else `settings.lutNumber`), export type (LUT = without payment of IGST),
     port code, shipping bill number and date (blank when not recorded).
  4. Credit Notes: number, date, original invoice and date, buyer, GSTIN, place of supply,
     Domestic/Export, taxable, CGST, SGST, IGST, total, reason; TOTAL row.
  5. Summary: count and amounts per tab, "Less: credit notes" (negative) and "Net of credit
     notes"; first/last number, count and cancelled count per series; cancelled numbers; the
     NOTE row.
- **Rules**: only documents dated in the month (IST); cancelled invoices are left out of the
  tabs and totals and listed on the Summary (as GSTR-1 Table 13 counts them). Delivery charges
  are their own row under SAC 996819 with audit note "Delivery / freight (18%)"; our invoices
  bill freight under the principal goods' HSN (composite supply), so the note adds "billed
  under HSN … on the invoice" when they differ.
- **Numbering note**: new optional series field `carriedFrom { last, fyStartYear }`
  (`packages/invoices/src/series.ts`), edited in GST app › Settings › Numbering series ›
  "Last number from your previous system". When the domestic invoice series has one for the
  register's FY and already has a Koomerce invoice, the Summary says "From <date of the
  series' first invoice of the FY> invoices are numbered INV/26-27/NNNN (previously
  VI/26-27/…)." plus, when the export series has one, "Export invoices continue <first export
  number of the FY, else the next one> after <its last>." Next FY the field no longer matches,
  so the note goes away by itself.
- Tests: `packages/plugin-gst-invoices/test/sales-register.test.ts` (reads the workbook back
  with a small test-only reader, `test/xlsx-read.ts`).

**For Waimers** (owner): fill "Last number from your previous system" with `VI/26-27/642` on
Tax invoices (or the real last VI number) and `VI/EXP/26-27/001` on Export invoices, and save.
