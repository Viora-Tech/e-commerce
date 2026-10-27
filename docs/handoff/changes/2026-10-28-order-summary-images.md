# Order summary photo for variants without their own image

Thank-you and pay pages built their order summary with `variantImageUrls`, which only read `variant.media_id`; a product whose photos are on the product (not per variant) showed a letter tile. It now falls back to the product's first photo through the cart's `productFirstImages` (now exported). Test in `cart.test.ts`. Fixes #864.
