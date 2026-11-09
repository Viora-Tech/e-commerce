# ShipGlobal: vendor API instead of the old Label API (#1429)

**Bug.** Connecting ShipGlobal said "ShipGlobal did not accept this API login" for a username and
password that work in ShipGlobal's own API docs. The adapter called the old Label Generation API
(`labels.shipglobal.in/api/v1`, email + password → bearer token). ShipGlobal's current vendor API
(https://developer.docs.shipglobal.in/, "ApiV1 ShipGlobal Vendor - Production", published
2026-11-03) is on `https://app.shipglobal.in/apiv1/...` with HTTP Basic auth on every call.

**What changed (packages/shipping-shipglobal).**
- Basic auth to `app.shipglobal.in`. A refused login is HTTP 401 or `error_code: "EA_401"`; only
  that shows "did not accept this API username or password". A ShipGlobal outage no longer blames
  the login.
- Test connection asks for a sample rate (US 10001, 0.5 kg): read-only, nothing charged.
- New: live rates (`quoteOptions`/`quoteRate` from `/apiv1/rates/calculate`), tracking
  (`/apiv1/tools/tracking`, SGE_* event codes mapped to our statuses; `tracksManually` is now
  false, so the shared poll job tracks it), cancel with refund (`/apiv1/order/cancelRefundOrder`),
  and `getLabel`.
- Booking = `/apiv1/order/add` then `/apiv1/order/getLabel {tracking, label:true}` (pays from the
  ShipGlobal wallet, returns the PDF). If the label step fails, the error names the saved order's
  tracking number so nobody books it twice.
- Config: `username` (a login saved under the old `email` key is still read), `password`,
  optional `addressNickname` (ShipGlobal pickup address) and `customerNickname` (franchise only),
  origin PIN/city, IEC (kept on file; ShipGlobal reads it from KYC), IOSS, default service by
  ShipGlobal's own title ("ShipGlobal Direct", …). Old Label-API service codes fall back to
  ShipGlobal Direct. Seller nickname, seller address and GSTIN are no longer sent: the vendor API
  takes them from the ShipGlobal account.
- Admin: Connect page asks for the API username; overview lists the new capabilities and drops
  the manual "Parcels on the way" card (tracking is automatic now). English and Hindi copy, app
  listing and catalogue updated.

**VERIFY with ShipGlobal (marked `VERIFY:` in code).**
- The answer to `order/add` is not in the docs; we read `tracking`, then `data.tracking`,
  `awb_number`, `awb`.
- Service name case: the order sample says "Shipglobal Direct", rates say "ShipGlobal Direct"; we
  send the rates' title.
- Whether `subtotal_fee` includes GST; whether a second `getLabel` charges again.
- Tracking times have no zone; read as India time.
- `customer_shipping_email` when the order has none (sent empty).

**Checks.** shipping-shipglobal: 29 tests (the new sign-in tests failed on the old code),
typecheck clean. core `courier-rates.test.ts` 27 passed. admin `i18n.test.ts` 21 passed (Hindi
shape). Biome clean on touched files. Admin full typecheck could not run in this worktree (13
packages failed to link: path too long); no errors were reported in the touched files.

**After deploy.** Reconnect ShipGlobal with the API username and password. First live check: Test
connection (rates only). Book one real export only with the owner's OK.
