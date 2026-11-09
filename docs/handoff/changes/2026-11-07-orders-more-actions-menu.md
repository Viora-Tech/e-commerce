# Orders More actions: scrolls, prints issued invoices (2026-11-07)

- The bulk More actions menu keeps the dropdown's height cap, so it scrolls instead of running
  off the screen (it was `max-h-none` since audit #9).
- Print invoices: with the GST invoices app installed it shows only when some selected orders
  have an issued tax invoice ("Print N invoices") and prints those PDFs merged
  (`gstInvoices.forOrders` + `bulkPrint`). Without the app it prints the store's invoice
  template as before. Fixes #1254.
