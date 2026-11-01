# Shopify import: API 2026-10, purchase orders and transfers (audit #75)

The rest of the "Shopify scope bundle" (markets came in d75cec6a).

## API 2026-10

- `SHOPIFY_API_VERSION` is `2026-10` (was `2025-07`; Shopify's docs endpoint no longer serves 2025-07).
- All 37 importer queries plus the count and shop queries were validated against Shopify's 2026-10 schema. None uses a removed field. Still deprecated but working: `Customer.email/phone/emailMarketingConsent/smsMarketingConsent` (use `defaultEmailAddress` / `defaultPhoneNumber`), `ProductVariant.barcode/image`, `Collection.ruleSet`, `codeDiscountNode`. These can move later, each in its own change.
- Bulk (`bulk.ts`): polls `bulkOperation(id:)`, because `currentBulkOperation` is deprecated. The "another one is running" pre-check is gone, since 2026-01+ allows 5 bulk queries per shop. **`groupObjects: true`** is now passed explicitly: 2026-01 flipped the default to false (a breaking change), and `streamBulkRoots` needs each record's children right after it.

## Purchase orders and transfers

- **Choice: two new Store settings parts** (`purchase_orders`, `transfers`), not main-import resources. Why: they depend on locations, which only the Store settings import maps (`settings_locations`). They are a handful of records read in one request, not bulk streams. The settings plan already has the "import products first, then again" pattern (`profile_products_missing`), codes-only lines and per-part savepoints. A main-import resource would need snapshot, progress, status counts and retry plumbing, with no locations mapping to use.
- Files: `settings-plan-stock.ts` (pure plan), `settings-import-stock.ts` (writes), with queries in `api-settings.ts`.
- Lines: Shopify product → products mapping → our variant by SKU, then title ("Default Title" is our "Default"), then the product's only variant. If any line is not matched, the record waits (`stock_products_missing`).
- Suppliers are matched by name, case and spaces ignored, or created (`saveSupplier`, IN/INR).
- Locations: matched by mapping or by name, or made by the Locations part in the same import, which runs first; the write then finds them through the mapping. Otherwise the record waits (`stock_location_missing`).
- POs: DRAFT → draft; ORDERED → ordered (`markOrdered`, so units become incoming); archived → closed, or cancelled if it was a draft. Only INR comes over, because Shopify gives no exchange rate (`po_currency`). A PO with receipts on Shopify gets a `po_receipts` warning.
- Transfers: DRAFT/READY_TO_SHIP → draft, IN_PROGRESS → in transit (incoming at the destination), TRANSFERRED → received. On-hand never moves (it came with products). CANCELED/OTHER → `transfer_status`. A receipt with no origin → `transfer_origin`.
- Re-runs: mappings `settings_purchase_orders` / `settings_transfers`. A record that is still here shows `same`. A record deleted here is imported again.
- Scopes: `read_inventory_purchase_orders`, `read_inventory_transfers` are added to `ALL_SCOPE_HANDLES`, `SETTINGS_PART_SCOPES`, both tomls, SUBMISSION.md, admin labels (en + hi) and the three docs. `read_markets` was also added to those docs.

## Owner to do

1. `shopify app deploy` (both configs), then **submit the app for review** with the two new scopes.
2. **Reconnect Waimers** so the token gets them; until then both parts show "Needs access".
3. Store settings › Check Shopify: PO #1 (Kyomi, ₹65,000, Ordered) and #T0001 should show as create. Import products first if they wait.

## Not done

- Non-INR purchase orders, received quantities per line (2026-10 PO lines have none), supplier details beyond the name (Shopify shares only `supplierName`), and transfer shipments/tracking.

Tests: `test/settings-plan.test.ts` › purchase orders and transfers (pure plan, re-run, access), `test/stock-import.test.ts` (writes, DB), `test/bulk-and-concurrency.test.ts` (bulk polling).
