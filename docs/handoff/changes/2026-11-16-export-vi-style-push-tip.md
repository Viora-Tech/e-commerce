# Waimers export invoices in VI/EXP style; push "no pop-up" tip (16 Nov 2026)

- Migration `0252_waimers_export_vi_style`: Waimers' three FY 2026-27 export invoices become
  VI/EXP/26-27/001 (#2203), 002 (#2344), 003 (#2460), the numbers on ShipGlobal's export papers
  and the store's earlier invoices. Guarded like 0251; the store's export series pattern is set to
  `VI/EXP/{FY}/` with 3 digits in its settings, so the next one is VI/EXP/26-27/004.
- Account -> Notifications -> Push: once push is on, the card says what to check when a test
  shows no pop-up (OS notifications for the browser, Do Not Disturb/Focus, Brave's push setting).
