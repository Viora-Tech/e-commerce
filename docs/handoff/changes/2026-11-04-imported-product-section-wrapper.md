# Imported themes: our product section shows the theme's look

`MainProduct` replaces an imported theme's `main-product` but was not inside `.shopify-section`, so
every rule fenced with `:not(:where(.shopify-section *))` still applied and our look beat the
theme's (square quantity box, chip badges, dashed UPI box, 40px title). The storefront now wraps it
in `.shopify-section` on an imported theme. `section-product.css` adds what the theme's section and
its pre-order app set around the buy box. Capital titles take the theme's `.h2`.
