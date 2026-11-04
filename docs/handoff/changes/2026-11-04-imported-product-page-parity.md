# Imported themes: product page, tabs and Razorpay window match Shopify

Seen on Waimers, comparing the Shopify store with the imported theme on Koomerce.

- **Product tabs were blank.** `.product-tabs__panel:not([data-current])` in our stylesheet hid every
  panel of an imported theme, whose markup never sets that attribute. The two `:not([data-*])` rules
  are now fenced, and the `theme-css-fence` sweep fails on any unfenced rule of that shape.
- **Razorpay window.** With every method on we send no custom blocks, so Razorpay draws its own
  window (logos, offer tags, live UPI QR). Custom blocks render as plain rows and are only used to
  hide a method; the EMI block there now lists card EMI, all cardless lenders and pay later. The
  window takes the store's name when no name is saved for the gateway (`merchantName`).
- **Product page.** `MainProduct` replaces the theme's `main-product`, so that section's stylesheets
  never loaded. `mainProductStylesheets` reads them from the section's source and the storefront
  links them on product templates.
- **New `MainProduct` settings:** `showRatingInvite` (empty stars and "Be the first to review") and
  `showPreorderBadge`. On imported themes they default to on and off. The import also switches
  `showUpiPrice` on when the theme's offer block has a percentage.
- **Pre-order badges** use `--color-brand`, not `--color-accent`, which is cyan on Waimers.

A theme imported before 3 November has none of the look settings in its saved template (capitals,
solid Add to cart, grid badges, stars). Set them in Customize, or import the theme again.
