# dev green again after the CSV injection fix

- `plugin-affiliates/src/server.ts`: `payouts` and `stats` both export `csvCell`, so `export *`
  was ambiguous (TS2308, worker typecheck). The package now re-exports the payouts one explicitly.
- `plugin-affiliates/test/csv-injection.test.ts`: the second assertion expected an `=` in every
  output, which failed for `+1`, `-1+1` and `@SUM(A1:A9)`. It now checks that the value survives
  behind the leading quote.
- `core/src/order/draft-reserve.ts`: two `useOptionalChain` lint fixes (same behaviour).
- Note: `core/src/returns/returns.test.ts` "settles with store credit or an exchange draft" can hit
  `order_store_number` duplicates in a full parallel run; it passes alone. Not changed here.
