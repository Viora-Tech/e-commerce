# 11 Nov 2026: courier refusal reasons, ship-from Edit, shipping row menus, item ticks (#1503–#1507)

- **Courier refusals keep their reason (#1503).** `courierFetch` reads a 4xx body
  (`courierRefusalReason`: JSON `message` / `remarks` / `errors`…, or short plain text; never HTML)
  into `CourierError.reason`. Admin paths use `describeCourierFailureForStaff`: "The courier
  refused it: Order id already exists" instead of "The courier did not answer". Shoppers still
  get `describeCourierFailure`. RapidShyp's 400 on #2461 now shows its reason.
- **Ship-from Edit (#1504).** Create shipment's Edit / Add pickup address open
  `/settings/shipping?open=dispatch` (the section that holds the warehouse address);
  `routes.settings.shipping(open?)`.
- **Row menus (#1505).** Shipping profiles and a profile's delivery areas get a ⋯ menu: Edit,
  Delete (asks first, same words as the page's Delete). General has no Delete.
- **Courier app pages (#1506).** `ProviderOverviewPage`: Connected is a green chip (no second
  icon), the connected body has its own gap, and "Not yet available" lists (`unavailable: true`)
  use a muted info mark instead of green ticks.
- **One Create shipment in bulk (#1507).** `useOrderAppActions.items` folds every courier app's
  Create shipment into one bulk item that compares all couriers; the order page and row menu
  already have their own, so app copies are dropped there.
- **Item ticks (Figma 916:10179).** `PartialPicker` is the Package card's item list: tick, picture,
  price and weight, count; unticking shows Parcel 1 (ships now) / Parcel 2 (stays in To ship) and
  Ship only these. Package step no longer lists the items twice. Not built yet: the split reason
  select and "Tell the customer it ships in 2 parts" toggle (no backend).

Tested: shipping package tests (new `courier-refusal.test.ts`), API tests, admin shipments /
orders / apps / shipping-zones tests, tsc, sweeps, lint:components on changed files.
