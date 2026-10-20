# Locations: edit an existing location's name, address, state and phone

Branch `feat/edit-location-address`. No migration.

- **Why**: only `createLocation` existed, so the auto-created "Default location" could never get
  an address or state. With no state, Settings › Locations showed "No state added", courier pickup
  stayed off ("needs full address") and "Bills under" could not follow a state.
- **Core** `updateLocation` (`packages/core/src/inventory/update-location.ts`, input
  `LocationUpdateSchema` in `inventory/schemas.ts`): writes name, line 1, city, state, PIN and
  phone; a blank field clears it; `line2` is kept when left out (the form has no second line).
  State must be one of `INDIAN_STATE_NAMES` (`BAD_STATE`). Store-scoped by RLS plus an explicit
  `storeId` filter (`LOCATION_NOT_FOUND` for another store's id).
- **Bills under follows the state (decision: auto-pick)**: after an edit, a linked GSTIN from
  another state is unlinked (the link rule in `tax/registrations.ts` would refuse it anyway); if
  the location is then unlinked and the state has exactly one active GSTIN, that one is linked.
  Two or more GSTINs in the state stay "Not chosen" for the merchant. No state: the link is kept.
- **API** `inventory.updateLocation` (`INVENTORY_WRITE`), errors through `friendly` as 400s.
- **Admin**: "Edit address" button on Settings › Locations › one location
  (`components/settings/locations/edit-location-dialog.tsx`), shown with `INVENTORY_WRITE`. The
  fields are shared with Add location via `components/inventory/location-address-fields.tsx`
  (Add location gains a phone field). After a save the "Bills under" select shows what the server
  picked. Stale copy "Add it under Products › Inventory" replaced by "No address added yet."
  `locationsContent` now has a Hindi overlay (`data/hi/inventory.ts`).
- **Tests**: `packages/core/src/inventory/update-location.test.ts` (Postgres); store isolation
  and a happy path added to `packages/api/test/inventory.test.ts`.
- Left alone: `inventory-page.tsx` and `transfers/single-location.tsx` still read
  `locationsContent.add` directly (English only).
