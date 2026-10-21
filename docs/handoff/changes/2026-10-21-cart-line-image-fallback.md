# Cart lines fall back to the product's first image

`getCart` used only the variant's own image, so imported single-variant products (no variant image) showed a blank thumbnail in the cart page, cart drawer and the checkout summary (a letter placeholder). Lines without a variant image now use the product's first image by position, like Shopify. Found by a guest smoke test on the live Waimers store (8K Dongle).
