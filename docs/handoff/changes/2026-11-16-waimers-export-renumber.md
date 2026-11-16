# Waimers export invoices renumbered (16 Nov 2026)

Owner decision: FY 2026-27 export invoices start at 1 in this series (the old system's
VI/EXP/26-27/001 is a separate series). Migration `0251_waimers_export_renumber` moves

- #2203 Michael Heiden: EXP/26-27/0003 -> 0001
- #2344 Tristan Santos: EXP/26-27/0004 -> 0002
- #2460 Max Tuson Clark: EXP/26-27/0002 -> 0003

and sets the export series' next number to 4. Number, seq and the snapshot's printed number move
together; `pdf_status` goes to `pending`, so the next download renders the PDF again.

It only runs when all three rows still have their old numbers, are issued and are not in a filed
GSTR-1; anywhere else it logs a NOTICE and changes nothing. The app itself still never renumbers
an issued invoice; this is a one-off allowed because November's GSTR-1 was not filed yet.
