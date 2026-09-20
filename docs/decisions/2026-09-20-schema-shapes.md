# Schema shapes decided up front

Date: 2026-09-20. Decided by Kuldeep. These are the shapes that are expensive to
change later, so they are fixed before the code that uses them exists. Everything
not listed here is designed in the PR that first needs it, following Medusa's
module shape.

## Already in place (session one)

- `store_id` on every tenant table, RLS enabled and forced, policy `store_isolation`.
- Money as integer paise.
- Order lines copy `unit_price_paise` at purchase time.
- `inventory_level.reserved` separate from `on_hand`.

## Product options and variants — structured

`product_option` (store_id, product_id, name, position) and
`product_option_value` (store_id, option_id, value, position). A variant is one
combination, linked through `variant_option_value` (variant_id, option_value_id).
Glide's option pickers and the quiz filters read these directly. Same shape as
Shopify and Medusa. Arrives with the product page PR.

## Product specs — typed attribute rows

`attribute_definition` per store (key, label, type: text|number|boolean|select,
unit, group, position) and `product_attribute` (product_id, definition_id, and
typed columns value_text, value_number, value_boolean). Replaces Shopify
metafields and spec groups. Meilisearch facets on them, the quiz filters on
them, admin renders the right input from `type`. Arrives with the product page
PR.

## Media — one shared table

`media` (store_id, r2_key, mime, bytes, width, height, alt). Products, variants,
content and blocks reference `media.id` through join tables (`product_media`
with position). Uploaded once, used anywhere, deleted only when unreferenced.
Arrives with the product page PR.

## Addresses — one table

`address` (store_id, name, line1, line2, city, state_code, pincode, country,
phone). `customer_address` links customers with a default flag. `order` holds
`shipping_address_id` and `billing_address_id`. `state_code` drives CGST/SGST vs
IGST. Arrives with the checkout PR.

## Store domains

`store_domain` (store_id, hostname unique, is_primary). Resolved by a
`SECURITY DEFINER` function `resolve_store(hostname)` so the lookup works before
a store context exists. Arrives with the hostname routing PR.
