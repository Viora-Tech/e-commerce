# Stock section split from Products (2026-10-10)

The Products menu had grown to eight items. Buying and moving stock is now its own sidebar section, **Stock**:
- Inventory
- Purchase orders
- Inbound shipments
- Suppliers
- Transfers

Products keeps All products, Collections and Gift cards.

- **Routes:** `routes.stock.*` in `apps/admin/src/lib/routes.ts`; pages live under `app/(admin)/stock/`. `/stock` opens Inventory.
- **Old links:** `/products/{inventory,purchase-orders,inbound-shipments,suppliers,transfers}` and their sub-pages redirect (307) to `/stock/...` from `next.config.ts`.
- **Hindi:** the section is named स्टॉक; page names moved to the new paths.
- **Home:** the low-stock link now points to `/stock/inventory`.
