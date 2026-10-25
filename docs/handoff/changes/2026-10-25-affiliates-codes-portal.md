# Affiliates v1.1, PR 4a: codes table, coupon rotation, code requests, link builder

Stacked on PR 3a (#761). Design §4 codes table and §5 portal. Creatives move to PR 4b (media upload).

- `affiliate_code` (migration `0170_affiliate_codes`, backfilled from `affiliate.code` and `coupon_code`): every link code and coupon an affiliate has had. `affiliate.code` / `coupon_code` stay the current ones.
- `src/codes.ts`: `linkCodeIs` (matching and click counting accept retired link codes, so old posts keep earning), `ensureCoupon` (moved here; records the coupon), `rotateCoupon` (old discount disabled, new code made), `requestCode` / `decideCodeRequest` (`affiliate.code_request`; approval changes the link code and remakes the coupon from it), `listCodes`.
- API `affiliates.rotateCoupon`, `affiliates.decideCode`; `affiliates.get` returns `codes` and `codeRequest`.
- Admin: affiliate page Codes card (current codes, Replace discount code with a confirm, approve/decline a request, earlier codes).
- Storefront portal: link builder (product search via `/api/search/suggest` or a pasted store URL; other sites refused), QR PNG download (`qrcode`), WhatsApp share; "Want your own code?" request form (`requestCodeAction`, rate limited).
- Merchant guide: Codes and Affiliate dashboard sections.
