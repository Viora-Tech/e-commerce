# Liquid support in Koomerce

What the Koomerce Liquid engine (LiquidJS with Shopify's tags, filters and objects on Koomerce
data) handles for imported themes, as of November 2026.

## Templates and sections

| Shopify | Koomerce |
| --- | --- |
| `templates/index.json` | Home |
| `sections/header-group.json`, `footer-group.json` | Header and footer groups |
| `product`, `collection`, `page` templates and alternates (`page.about.json`) | Same templates; the first `main-*` section becomes Koomerce's own |
| Sections, theme blocks, snippets, `{% schema %}` | Rendered; schemas become Customize fields (text, rich text, number, range, select, radio, checkbox, image, colour, colour scheme, product, collection, blog, page, menu) |
| `layout/theme.liquid` | Head, CSS variables, body before the header and after the footer |
| Section wrappers | Shopify-shaped ids (`shopify-section-template--...__<key>`) |

## Objects

`shop`, `settings`, `routes`, `request`, `localization` (markets), `product`, `variant`,
`collection(s)`, `all_products`, `linklists`, `blog(s)`, `article`, `page`, `customer` and
`customer.orders`, `cart`, `recommendations`, `predictive_search`, `collection.filters` and
`search.filters`. Metafields map to Koomerce extra fields (products and collections) and
metaobjects to content types; app namespaces stay blank unless a Koomerce app fills them.

## Behaviour swap

| Theme calls | Answered by |
| --- | --- |
| Add to cart forms, `/cart/add(.js)` | Koomerce cart, then the cart page |
| `/cart.js` | Count and total from the Koomerce cart |
| `/cart/change.js`, `/cart/update.js`, `/cart/clear.js` | The Koomerce cart page |
| `?section_id=`, `?sections=` | The theme's own section rendered by the Koomerce engine |
| `/search/suggest(.json)` | Koomerce search in Shopify's shape |
| `/recommendations/products(.json)` | Koomerce related products (merchant picks, shared collection, type, vendor, tags, best sellers) |
| `Shopify.customerPrivacy` | Koomerce consent |
| `form 'customer'` (newsletter) | Koomerce newsletter with double opt-in |
| `form 'contact'` | The Forms app (honeypot, rate limit); without it the form says it is unavailable |
| Checkout | Koomerce checkout, never themed |
| Customer account forms | Koomerce account pages |
| `@app` blocks | Left out, listed in the report |
| Reviews metafields, Judge.me `shop.metafields.judgeme.*` | The Reviews app when installed |
| Pre-order apps | Koomerce pre-order as a selling plan group |

## Safety limits

- Render budgets cap time, output size, parse size and memory: 2 seconds per render pass and a
  total time per page, so one heavy section cannot hold the server. Keep loops over products and
  collections small.
- Theme scripts get the page's CSP nonce; inline event handlers are blocked (the common
  `media="print" onload=...` stylesheet trick is replayed for you).
- In Customize, the canvas shows section HTML with everything that can run removed.
