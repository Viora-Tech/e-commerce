# Discounts list: revenue for imported orders, long values wrap (#994, #996)

- #994: Revenue, Discount given and Last used read ₹0 or Never for codes used on Shopify. Imported orders keep `discount_code` (several codes joined by commas) but have no `discount_usage` rows. `addImportedUsage` (packages/api/src/services/discount.service.ts) now adds imported, non-test orders matched by code. The amount given is the order's `discount_paise`; cancelled orders add nothing.
- Still expected: a code used only by test orders, or by orders that were cancelled or never paid, shows uses but ₹0 revenue.
- #996: the Value cell wraps (2 lines max) instead of running over the Type column.
