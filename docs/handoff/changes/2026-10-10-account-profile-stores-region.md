# Account: Profile, Stores, Language & region

Branch `feat/account-page` (part 1 of 3 of the member Account area; security + sessions and
notifications + delete account follow as their own PRs).

- **Account rail** (`components/account/account-nav.tsx`, `ACCOUNT_NAV` in
  `apps/admin/src/data/account.ts`): Profile (`/account`), Stores (`/account/stores`),
  Language & region (`/account/language`), Appearance. The account menu keeps
  `ACCOUNT_MENU` (Account, Appearance), then Settings and Log out. Rail and menu names come
  from `accountContent.pages`, so both follow the admin language.
- **Profile** (`components/account/profile-page.tsx`): photo, full name, email (read-only),
  mobile. Save bar + header Save.
  - Mobile is stored as E.164 on `user.phone` (migration `0109_member_phone`, platform table,
    no RLS; written only by `account.updateProfile` for the caller's own row). Rules in
    `@commerce/core/member-account` (`normaliseMemberPhone`, `MemberProfileInputSchema`):
    10 Indian digits get +91; other countries need a leading +.
  - Photo: cropped square in the browser (`avatar-crop-dialog.tsx`, drag + zoom + arrow keys),
    sent as a data URL to `account.setAvatar`, re-encoded with sharp to a 256 px WebP
    (`processAvatar`, EXIF/GPS dropped, non-images refused) and written to the **active
    store's storage** at `stores/<storeId>/avatars/<userId>/<uuid>.webp` (not a media-library
    row). `user.image` holds the public URL. The previous photo is deleted when it lives in
    the same store. Rate limit 20 changes/hour per member.
  - Better Auth's client-callable `update-user` can no longer set `image`: a
    `databaseHooks.user.update.before` in `packages/auth/src/merchant.ts` refuses any update
    carrying one, so a member cannot point their photo at an outside URL that teammates'
    browsers would then load. Nothing in the apps used `updateUser`.
  - `MemberAvatar` (`components/account/member-avatar.tsx`) shows the photo with an initials
    fallback in the top bar, the sidebar user row, Settings → Staff and Profile. Staff rows now
    carry `image` from Better Auth's member directory.
  - After a save the client reads the session with `disableCookieCache`, which rewrites Better
    Auth's 5-minute cookie cache, so the shell shows the new name/photo at once.
- **Stores** (`components/account/stores-page.tsx`, `account.stores` / `account.leaveStore`):
  every organization the member belongs to, role (store role, falling back to Better Auth's),
  owner flag, Current chip, Switch to, Leave. Owners cannot leave (refused in the API, with
  Better Auth's own "only owner" guard behind it); leaving removes the Better Auth membership
  (which clears it as the active store) and the `store_member` row.
- **Language & region** (`components/account/language-region-page.tsx`): the admin language
  (moved from `/account`) plus 12/24-hour time and week start, stored in the `admin_region`
  cookie (`lib/region.ts`), read by the root layout into `RegionContext`. `useFormat()` now
  formats `when`, `dateTime` and hour patterns in the member's clock; direct
  `formatWhen`/`formatDateTime` callers and the four server components that call
  `formatters(await getLocale())` stay 12-hour for now. Week start orders the shipping
  weekday checkboxes (`orderWeekdays`); `formatters().weekStartsOn` is there for the first
  day picker.
- Settings search: Profile, Your stores, and Admin language (now `/account/language`) entries,
  all via `routes`; the admin-routes allow-list for that file went 46 → 44.
- Tests: `packages/api/test/account.test.ts` (own-row profile writes, phone refusal, stores
  list scoped to the member, staff can leave, owner and non-member cannot, Better Auth cannot set
  a photo URL) — run, pass.
  `packages/core/src/member-account/*.test.ts` and `apps/admin/src/lib/region.test.ts`.
- Docs: merchant guide **Your account** (`apps/docs/content/merchant-guide/settings/your-account.mdx`),
  Settings home and Admin language pages point there.
