# Shopify import reads the filter list on the store's primary domain

Branch `fix/import-filters-primary-domain`. No migration.

- `storefront-filters.ts` asked `https://<store>.myshopify.com/collections/all` for the store's
  Search & Discovery filters. A store on its own domain (Waimers on waimers.in) answers that
  address with 402, so no field was marked "Use as filter" and the storefront fell back to its
  guessed filters (sensor, DPI, rating count…).
- It now reads `shop.primaryDomain` from the Admin API and tries that address first, then the
  myshopify one; the first page that names any filters wins.
