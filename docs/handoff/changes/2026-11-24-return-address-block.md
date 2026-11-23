# Return address as one grouped block (24 Nov)

## What
Settings › Shipping › When orders go out › More options: the return address was six
label-left / input-right rows with a divider under each. It is now one block
(`apps/admin/src/components/settings/return-address-fields.tsx`):

- Heading "Pickup and return address" with one line saying couriers pick up from here and
  returns come back here.
- When line 1 is empty, a muted note: "Empty: couriers use your store address from Store
  details." with a link to Settings › Store details.
- A compact grid: Name + Phone, Address line 1, Address line 2, City + State (two columns on
  sm and up, stacked on phones). No dividers between fields.
- State is now the Indian state picker used by Locations (`INDIAN_STATES` from `data/india.ts`),
  saving the same two-letter code (e.g. "HR"). A saved value that is not a known code stays in
  the list as typed, so nothing is lost.

`focusAddress` (Create shipment's Ship from › Edit, `?focus=address`) still opens More options
and scrolls the heading into view. What is saved and the settings schema are unchanged.

## Why
Owner, 24 Nov: the block was long and heavy, and empty fields hid that this address is also
Create shipment's Ship from, with the Store details address used when line 1 is blank
(`packages/core/src/shipping/ship-from.ts`, `storeFallback`).

## Copy
`policy.warehouse` renamed in wording, new `warehouseHelp`, `warehouseEmpty`,
`warehouseEmptyLink`, `statePlaceholder`; `state` is now "State". Hindi in `data/hi/shipping.ts`.

## Tests
`bun run typecheck` (apps/admin) and `npx biome check` on the changed files pass; the component
structure checker reports nothing for them. Check by eye on localhost:3200: empty and filled
address, phone width, and Ship from › Edit on Create shipment.
