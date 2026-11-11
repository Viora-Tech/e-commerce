# General profile: honest empty state and "Move products here" (#1579)

- **Empty state:** General with no delivery areas showed "Delivery is free on every order" even when
  another profile has areas, which makes every General product unbuyable (`quoteProfiles`). The
  profile page now passes `othersHaveAreas`; General then shows "These products cannot be bought"
  and asks for a delivery area (a free one is fine).
- **Move products here:** General's page has a card with the product picker. Picked products and
  their single variants leave the custom profiles holding them (`moveProductsToGeneral` in
  `core/shipping/profile-placement.ts`, API `shipping.profiles.moveToGeneral`, settings.manage).
- Test in `profiles-service.test.ts` (moves products and single variants, other store untouched,
  repeat moves nothing). Copy in `data/shipping-rates.ts` + Hindi.
- Found on Claw Gears: General had no areas while Skates had Delhivery/Bluedart, so pads could not be
  bought; the owner adds a delivery area to General.
