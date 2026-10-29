# Admin phone field no longer shows a leading 0 (follow-up to #926)

Branch `fix/admin-phone-zero`. No migration.

- **Cause:** same as #926. The admin `PhoneInput` (`packages/ui/src/components/phone-input.tsx`,
  react-phone-number-input) fills its box from libphonenumber's `formatNational()`, which writes
  Indian numbers with the optional trunk 0, so a saved `+919999999999` showed as `099999 99999`.
- **Fix:** new client-safe package `@commerce/phone` (`packages/phone`, only dependency
  `libphonenumber-js`) exports `phoneInputMetadata`: the min metadata with optional
  national-prefix rules removed. `PhoneInput` passes it as the picker's `metadata`. India shows
  `99999 99999`; UK (`07911 123456`), France and others whose format needs the 0 keep it.
- **Why a package:** `@commerce/ui` and `@commerce/blocks` share no runtime workspace package
  (`config` is server env code, `core` is server-heavy), and neither should depend on the other.
  The storefront field (`packages/blocks/src/components/store-phone-input.tsx`, fixed inline in
  #932) now imports the same `phoneInputMetadata`; its inline copy and its direct
  `libphonenumber-js` dependency are gone, and blocks lists `@commerce/phone` instead.
- `apps/admin/next.config.ts` and `apps/storefront/next.config.ts` list `@commerce/phone` in
  `transpilePackages`.
- `packages/ui/vitest.config.ts` now compiles JSX (`oxc` automatic runtime, as in admin), so a
  test can render ui components.
- Tests: `packages/phone/test/index.test.ts` (India no 0, UK/FR/US unchanged, typed 0 still
  parsed), `packages/ui/src/components/phone-input.test.ts` (box shows ten digits for E.164,
  10-digit, 0-prefixed, 91-prefixed, dashed values; UK keeps its 0).
