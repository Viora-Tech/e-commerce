# Weights: catch a product saved in the wrong unit

- Owner, 14 Nov 2026: a 1 kg mousepad was saved as 10,00,000 g (typed 1000 with the field on its
  default kg), and couriers quoted for 1,000 kg.
- Create shipment, Package step: "Check the weight before you book" when an item is saved over
  30 kg each or the parcel is typed over 30 kg (`lib/weight-check.ts`, `SUSPECT_GRAMS`).
- Product and variant weight field: a red line under it past 30 kg ("Check the unit").
- A variant's weight can no longer be saved over 100 kg (`core/catalog` schemas, same cap as
  `products.bulk`).
