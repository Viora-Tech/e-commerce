# Detail pages: side column stays in view again

The sticky side column (orders, products) was added in e30fb892 inside `detail-layout.tsx`, and
lost when 11b7b8b3 replaced that file with the shared page header. It now lives in the three
frames that draw a side column: `OrderPageFrame`, `ProoflyDetailPage` (products, collections,
discounts, blog, content types…) and `PageColumns` (customers, drafts, gift cards, purchase orders…).
On desktop (lg+) the side column sticks 1.5rem from the top and scrolls on its own when taller than
the screen; phones still stack it under the main column.
