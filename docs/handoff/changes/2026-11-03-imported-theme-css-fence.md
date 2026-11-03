# Imported themes: our theme-setting CSS no longer reaches their sections (#1046)

`globals.css` loads `@commerce/blocks/styles.css` on every page, imported Shopify themes
included, and the class names overlap. 19 selectors driven by our own theme settings were not
fenced off imported sections, so our defaults applied to the imported theme:

- `component-product-card.css`: quick-add hidden (`data-card-quick-add`), sale badge hidden
  (`data-card-sale-badge`), vendor, rating, wishlist, hover image, ratio and minimal style.
- `base.css`: outline primary buttons; `section-header.css`: dark-mode logo swap;
  `section-discord-cta.css`: dark glow.

Each now ends with `:not(:where(.shopify-section *))`, like the plain rules. Only the Liquid
renderer adds `.shopify-section`, so native themes are unchanged. New sweep `theme-css-fence`
fails on an unfenced one. Seen on Waimers: the home page's product cards lost their Add to cart /
Choose options buttons and their -N% badges.
