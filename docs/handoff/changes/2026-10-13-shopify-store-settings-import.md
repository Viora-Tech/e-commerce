# Shopify importer: Store settings (2026-10-13)

New page **Apps › Shopify importer › Store settings** (`/apps/shopify-import/settings`, also a card on the importer home). It brings the store's configuration over, not just the catalogue: press **Check Shopify** for a per-part preview, tick parts, press **Import**, read the per-part report. Re-running is safe: matched records show as "Matches".

Parts and rules:

- **Store details**: name, contact email and phone, business address → store profile. The default location gets the address only while it has none. Currency, time zone and weight unit are compared and warned about, never changed.
- **Tax and GST**: prices-include-tax switch. The GSTIN is taken only from a shop metafield that passes `validateGstin`, because Shopify has no Admin API field for it. A GST registration already here is never replaced; a different one shows as a conflict.
- **Locations**: matched by name (or by the import mapping), addresses and PIN codes updated. New ones have no stock, are not the default and do not sell online. Shopify's first shipping location only takes over the store's first location while that one is still called `Default location`. App-run locations are skipped.
- **Shipping**: the default delivery profile's zones and rates (flat, by order value, by weight, free over an amount) → shipping zones and rates. Carrier rates, value-and-weight rates, zones outside India, product-specific profiles and local pickup are listed under "Set up by hand". Existing rates of the same name keep their id, COD fee, free-above and delivery days.
- **Packages**: Shopify has no Admin API read for saved packages, so this part only says to add box sizes in Settings › Shipping.
- **Policies**: refund, privacy, terms, shipping, contact → policy pages through `htmlToRichText` (the importer's sanitiser); pictures inside a policy are left out and noted.
- **Extra field definitions**: products, variants, collections, customers, orders, where the type exists here (`planField`). A same-key field of another type is kept (conflict).

Code:

- Plugin: `api-settings.ts` (reads, per-part `Read<T>`), `settings-plan.ts` / `settings-plan-shipping.ts` / `settings-plan-content.ts` (pure planners), `settings-import.ts` (load, plan, apply each part in a savepoint), `settings-client.ts` (codes for the admin, re-exported from `client.ts`).
- Core: `settings/store-profile.ts` (`readStoreProfile`, `saveStoreProfile`, `saveLocationDetails`).
- API: `shopifyImport.settingsPreview` (apps.manage) and `shopifyImport.importSettings` (settings.manage, `heavy('import')`); both on the cross-store leak test's skip list (Shopify API).
- Scopes: `read_shipping` and `read_legal_policies` added to `ALL_SCOPE_HANDLES` (the admin's `SCOPES` now is that list). A part whose scope is missing shows "Needs access" with **Reconnect**; the other parts still work. Locations use the existing `read_inventory`.
- Admin: `settings-page.tsx`, `settings-part-card.tsx`, `settings-item-row.tsx`, `settings-lines.ts`; copy in `data/shopify-import-settings.ts` with the Hindi overlay.
- Mappings: `settings_locations`, `settings_shipping_zones`; extra fields share `metafield_definitions` with the main import.

No migrations. Never touches orders or stock. Unit test: `packages/plugin-shopify-import/test/settings-plan.test.ts` (recorded Shopify answers, no database).
