# FedEx: connect for tracking only

Inbound shipments read FedEx tracking (expected arrival) through the FedEx shipping app, but its
Connect page demanded an account number, origin PIN and city that only matter for booking
exports. A merchant who only receives FedEx consignments could not connect it.

- `packages/shipping-fedex/src/fedex.ts`: account number, origin PIN code and city are optional
  together. All three empty = tracking only; any one given = shipping, and then all three are
  checked as before. A tracking-only provider quotes nothing (`quoteOptions` `[]`,
  `checkServiceability` closed with the reason) and `createShipment` refuses with a message
  naming what to add. Neither calls FedEx. `track` and `verifyCredentials` need only the keys.
- Admin copy (EN + HI): the account number help says key and secret are enough for tracking.
- Merchant guide `apps/international-couriers.mdx`: callout under the FedEx tab.
- Tests: `packages/shipping-fedex/test/fedex.test.ts` "FedEx for tracking only".
