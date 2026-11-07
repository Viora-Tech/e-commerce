# Imported Shopify discounts keep their type

The Shopify importer saved discounts without a type, so every one became an "order" discount, even codes for chosen products or collections (Waimers and Claw Gears creator codes). Admin showed them as "Amount off order", they stacked as order discounts, and saving one failed.

The importer now sets the type from the rules (products/collections → amount off products, everything → amount off order, free shipping → shipping). Migration `0226_imported_discount_type` corrects the rows already saved.
