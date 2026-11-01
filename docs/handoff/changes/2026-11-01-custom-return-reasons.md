# Custom return reasons and single Connect headers

- #180: Settings › Returns › Reasons has "Your own reasons" (up to 8, 60 characters each). They are
  stored on `store.returns.customReasons`. A request saves the reason as `custom:<words>`, and
  `returnReasonLabel()` turns any stored reason into words for admin, emails and the report.
  Shoppers see them before "Something else".
- `returns.savePolicy` now keeps `exchanges` and `autoApprove`. Before this, zod dropped them and
  every save turned both off.
- #75/#195: Connect pages built on the shared connect page (payment gateways, couriers, S3) are
  `fullPages`, so they draw one header instead of sitting under the app header too.
