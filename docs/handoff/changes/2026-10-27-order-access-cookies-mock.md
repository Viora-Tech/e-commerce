# order-access.test.ts: add cookies to next/headers mock

Phase B (#807) made `checkoutCartId` read the host-only checkout session
cookie before falling back to the cart cookie:
`checkoutCartId → readCheckoutSession → (await cookies()).get(...)`.

`applyDiscountAction` goes through `checkoutCartId`, so `order-access.test.ts`
now hits `cookies()` from `next/headers` — but its mock only exported
`headers`, so the test threw `No "cookies" export is defined on the
"next/headers" mock`. #807 merged without a green full-test run (branch
protection doesn't gate on CI), so this slipped onto dev.

Fix: the mock now also exports `cookies` returning no checkout-session
cookie, so `readCheckoutSession` returns null and `checkoutCartId` falls
back to `readCartId` — exactly the pre-phase-B behaviour. 4/4 tests pass.
