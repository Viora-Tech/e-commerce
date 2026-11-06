# Shopify import moves a cancelled local order off a clashing number

When a Shopify order's number was held by a local order, only an abandoned online checkout moved aside. Direct UPI, COD and paid local orders stayed, so a real Shopify order could be skipped or merged with them. A cancelled local order (`status = 'cancelled'`, `importedFrom` null) now moves to the next number too, and Shopify's order takes the number. Only the number changes, so a cancelled paid order keeps its payments.

The check lives in `existingOrder` in `packages/plugin-shopify-import/src/write-orders.ts`. `paymentNotFinished` in core is unchanged, because the Orders views and analytics share it. An order already mapped to the Shopify order is still found first, open non-abandoned orders and imported orders behave as before, and a dry run moves nothing. Tests are in `packages/plugin-shopify-import/test/csv-import.test.ts`.

On Waimers, the local test orders #2408, #2409, #2410, #2412 and #2413 only give up their numbers once they are cancelled and this is deployed. Any of them still open when Shopify reaches that number keeps it, and the Shopify order is skipped.
