# Fixes from the 21–22 Nov testing (22 Nov 2026)

Found while the owner tested on localhost and on live, fixed straight on `dev`.

## Delivery options (checkout)

- **Split cart, one courier per parcel** (`parcels.ts`, ec375ac3f): a cart split by product rules
  whose parcels each had a single courier was added up into one card wearing the first parcel's
  courier name ("Delhivery Surface ₹139" while ₹139 was Blue Dart's). `parcelOptions` is now set
  whenever the parcels' picked carriers differ, not only when a parcel has a choice.
- **A courier's other speed** (`courier-list.ts`, d1809898d): only a same-price, later speed of the
  same courier is dropped (the arm sleeves' Blue Dart ₹139 case). A dearer speed stays even when
  its date is later: RapidShyp's Air dates are later than Surface for nearby PINs (Sonipat: Blue
  Dart Air 7 days, Surface 3) and unreliable for some far ones (Kochi, Guwahati 9 vs 6).
- **Rule dialog** (35450d4d0): a blank rule's live line names what is to be picked ("the
  collections you pick") instead of "0 collections"; saving or deleting a rule refreshes the
  layout so the sidebar's "Product rules N" count updates.
- **Cart page** (8993c8cdc): with the Delivery options app on, `cartShippingHint` promises nothing
  ("Calculated at checkout", no free-shipping bar). It used to read the shipping rates' zones and
  say "Free" while checkout charged by the app's rules.

## Shipments and orders

- **Insurance on a partial shipment** (`insurance.ts` `isPartOfParcel`, 6ad33d7bb): Create shipment
  priced insurance on the whole order when part of the only parcel ships now (a ₹3,799 wrist rest
  showed ₹254.98, on ₹29,798). The drawer's asked value now wins when it is below the parcel's
  total; booking already declared the part's own value.
- **Cancel un-shipped earlier units** (`parcel-split.ts` `separateShippedUnits`, 9e98ed252): a
  parcel with units already shipped (by hand, or before a Shopify import) was booked as one
  parcel, so cancelling the new label unpacked the earlier units too (#2073, #2082 on live).
  `createShipmentForOrder` now first moves the unsent units into their own parcel and books that;
  the shipped units stay in a fulfilled parcel. Skipped for a parcel whose packed units wait on a
  cancelled label (`rebookableParcels`).
- **Mark as unfulfilled on one line** (`undo-packed-line.ts`, `orders.markLineNotShipped`,
  19652f602): each line's ⋯ on the Fulfilled card. Refused while a label on its parcel is live; a
  hand-typed tracking number closes when its parcel has nothing packed left.
  `unpackFulfillmentOrder` takes an optional `orderLineId`.

## Repairing #2073 / #2082 on live

No database edit: after the release, #2073's keyboard is marked shipped again with Fulfil items
(which also takes it out of stock again); on #2082 the wrong line uses the new ⋯ › Mark as
unfulfilled.

## Left for the next release

- A free-shipping discount with "exclude rates over ₹X" on a cart split into parcels: checkout
  waives each parcel under ₹X, the order checks the total once. Needs the parcel sum to apply the
  discount once (delivery-cards `parcelCards` applies `afterDiscount` per parcel).
- The Glide theme's tracking page text (`locales/en.default.json` `preorder_text`, the Shop app
  card) is theme content on live, changed in Edit code, not in this repo.
- Localhost cannot email sign-in codes (no SES keys); the account pages and store credit tests
  run on live.
