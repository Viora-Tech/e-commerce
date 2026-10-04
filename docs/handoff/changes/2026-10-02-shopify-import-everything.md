# Shopify importer: import everything (files, content types, extra fields, discounts, gift cards)

Branch `feat/shopify-import-everything`. **No migration**: the new resources reuse
`shopify_import_run` / `_issue` / `_mapping` (`resources` and `resource` are free text, `progress`
is jsonb, so the new `left` summary lives inside it).

## What merchants get

- Apps → Shopify importer → Connect store → **What to import** now also lists **Files**,
  **Content types and entries**, **Extra fields**, **Discounts** and **Gift cards** (all ticked).
- Run page: a new **What stays in Shopify** card (English + Hindi) summing, per type and reason,
  what did not come over or arrived changed; the problems list still names each record.
- The whole importer admin is now on `useCopy` with a Hindi overlay (`data/hi/shopify-import.ts`).
- Docs: merchant guide **Move from Shopify** (`selling/import-from-shopify`), developer docs
  **Shopify importer** (`building/shopify-import`), Apps page scope list.

## What imports now

- **Files** → media library (images through the optimising pipeline; videos as the largest mp4
  rendition under 100 MB). PDFs/other documents, YouTube/Vimeo links, 3D models, oversize video
  and still-processing files are reported.
- **Metaobjects** → content types and entries; links between entries, to products, collections
  and files resolved after both sides exist (two passes each). Unsupported field types reported.
- **Metafields** on products and collections → extra fields (definitions made from Shopify's,
  or from the value for undefined ones). Other owners (variants, customers, orders, pages,
  articles, blogs, shop, locations, companies) are counted as "not imported yet".
- **Discounts** (code + automatic, basic and free shipping) → discounts, one per code; Bxgy, app,
  customer/segment, min quantity, variant-level, per-item, shipping country/price rules and bad
  code characters reported with the reason.
- **Gift cards**: Shopify never returns full codes, so live cards with a balance and a customer
  get a **new** code (same balance, linked, not sent; merchant presses Resend). No customer,
  empty, disabled, expired, over ₹2,00,000 or other currency → reported. Re-run adjusts the
  balance unless the card was spent here.

Field type map, order of work, `left` reasons: developer docs page. Refused scopes end only that
resource (issue names the scope); the rest of the run continues.

## Owner to do

Add read scopes to the Shopify Dev Dashboard app: `read_files`, `read_metaobject_definitions`,
`read_metaobjects`, `read_discounts`, `read_gift_cards` (release a new version, reinstall),
then **Test connection**.

## Notes

- Tests: `packages/plugin-shopify-import/test/import-everything.test.ts` (fake Admin API only).
- Visual check used a private dev DB `commerce_importall_dev` (seeded, runs created with the
  fixtures and a fake Admin API), admin on :3280.
