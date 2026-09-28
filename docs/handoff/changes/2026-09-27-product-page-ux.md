# Product page UX

**Product page UX** (27 September 2026, `claude/exciting-einstein-nos00p`): option chips build every
variant combination (ids carried over on add/remove, stock-loss confirm, bulk price/stock/SKU
prefix, SKU suggestions); category picker over Shopify's MIT Standard Product Taxonomy
(`product.category_id`, trimmed data from `scripts/trim-product-taxonomy.ts`, lazy-loaded);
collections card; per-product package box (`variant.box_preset_id`, `package_*_cm`) with a
volumetric hint, used by shipment booking when every line agrees; sticky side column, jump nav,
rare cards under "More settings"; "Google search preview". Migration `0072` (0071 is PR #182).
