# Our CSS no longer hides parts of Horizon

Horizon paints section grounds behind its content and uses class names we also use.

- `main#MainContent` stays transparent when the page has `.section-background`, so white theme text no longer sits on white.
- On such pages, our own sections take the theme's colours (`--color-ink`, `--color-bg`), which brings back the price and buttons on the product page.
- `.cart-drawer` and `.rte` rules skip `cart-drawer-component` and `rte-formatter`, Horizon's elements, so other themes are not touched.
- Section settings fill dynamic sources too, so "You may also like" reads its product instead of showing placeholders.
- A block's copied globals keep their getters, so rendering a block does not mark a page as per-customer.
