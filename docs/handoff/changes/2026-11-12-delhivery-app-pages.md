# Delhivery app pages: Overview, Shipments, Pickups, Pickup locations

Figma 928:11256 "Delhivery · Overview" plus the sub-pages its sidebar lists.

- **Overview** (`components/apps/delhivery/overview-page.tsx`) is Delhivery's own page now (the
  shared `ProviderOverviewPage` is untouched for the other couriers): Wallet (saved balance from
  `shipments.wallets`, Recharge to Delhivery One, Update to type the balance in, since Delhivery
  has no balance API), Booked today (+ charged), In transit (+ delayed), RTO this month (+ % of
  this month's bookings); Recent shipments (Delhivery only); Pickup locations card; Connection
  card (account, masked API key, webhook on/off, pickup name, Edit → Connect).
- **Shipments** (`/apps/delhivery/shipments`): `components/shipments/courier-shipments.tsx`, the
  Shipments table, tabs, filters, row menu and bulk actions with a fixed `provider` (no To book tab).
- **Pickups** (`/apps/delhivery/pickups`): `PickupsTab` takes an optional `provider`.
- **Pickup locations** (`/apps/delhivery/pickup-locations`): the account's own pickup location
  (Connect page name at Settings › Shipping's address, marked Default) and every location with
  courier pickup on, each with the next Delhivery pickup booked there.
- App bar: "Recharge wallet" header action; the pill says "API key working · last tracking
  update …" when the last change is under two days old; the in-transit count moved from the
  Overview row to Shipments.

Back end (no migration):
- `courierActivity` (core) now also returns `delayed` (moving and past `tracking.expectedDate`),
  `bookedToday`, `chargedTodayPaise`, `bookedThisMonth`, `rtoThisMonth`; still one statement.
- New `shipments.courierOverview` and `shipments.courierPickupPlaces` (`orders.read`), service
  `packages/api/src/services/courier-overview.service.ts`; `shipments.counts` takes an optional
  `provider`.
- Tests: `packages/core/src/shipping/courier-activity.test.ts`,
  `packages/api/test/courier-overview.test.ts`, `packages/shipping-delhivery/test/app-bar.test.ts`.
