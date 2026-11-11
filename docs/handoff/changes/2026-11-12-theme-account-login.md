# Imported theme account popover: no "[object Object]", working Sign in (#1576)

- `login_button` filter registered (`theme-import/filters.ts`): prints nothing, since there is no
  "Sign in with Shop" here. Unknown filters returned their input, so the shop object printed as
  "[object Object]" in Horizon's account popover.
- `routes.storefront_login_url` added (`theme-import/drops.ts`) → `/account/login`. Horizon's
  "Other sign in options / Sign in" link was empty.
- Test: `account-login.test.ts`.
