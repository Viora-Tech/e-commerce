# GST invoices: a Products tab for GST and HSN

The app gains a Products tab listing every product with its Charge GST switch, GST rate and HSN code, editable in the row or for many products at once (the selected ones, or every product a filter matches). Filters show products missing an HSN or with GST off.

Changes save on the product: HSN and rate on the product, with variant overrides cleared so every variant follows the row, and Charge GST on each variant. Checkout and invoices read them from the next order. API: `gstInvoicesProducts.list` and `.update` (`services/gst-product-tax.service.ts`).
