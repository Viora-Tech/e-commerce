# Our CSS no longer hides parts of Horizon

Horizon paints section grounds behind its content and uses class names we also use.

- `main#MainContent` stays transparent when the page has `.section-background`, so white theme text no longer sits on white.
- On such pages, our own sections take the theme's colours (`--color-ink`, `--color-bg`), which brings back the price and buttons on the product page.
- `.cart-drawer` and `.rte` rules skip `cart-drawer-component` and `rte-formatter`, Horizon's elements, so other themes are not touched.
- Section settings fill dynamic sources too, so "You may also like" reads its product instead of showing placeholders.
- A block's copied globals keep their getters, so rendering a block does not mark a page as per-customer.

Found by running the theme locally:

- `product-information` counts as a main section, so Horizon's product section no longer renders empty under ours.
- The page rules key on `#header-group`, so cart and search are covered, and they map our muted, line and surface colours too.
- `themeCardTemplate` builds Horizon's card from the collection template's blocks (`content_for 'block'`, stored on `_themeSections`). A card snippet that only wraps `children` is skipped.
- Search uses those cards through `blockCardsFor`, only for block-card themes.

Themes imported before this need importing again.
