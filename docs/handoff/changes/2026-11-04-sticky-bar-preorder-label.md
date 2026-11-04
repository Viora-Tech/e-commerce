# Imported themes: the sticky bar says the pre-order label

A theme's sticky bar prints "Add to cart"; on Shopify the pre-order app's script relabels it. That
script does not run here, so `ProductBuyButtons` sets `[data-sticky-atc-label]` and its
`data-add-label` on a pre-order variant and restores them when the variant is not one.
