# Sign in as customer (staff impersonation of a shopper)

Asked for by the store owner. Customer page › More actions › **Sign in as customer** opens the
storefront in a new tab, signed in as that shopper for one hour.

## Who may

- New permission `customers.sign_in_as` (`permissions.CUSTOMERS_SIGN_IN_AS`). In Settings › Roles it
  is the **Sign in as** row under **Customers**.
- The owner always has it. Administrator and Staff (built-in roles) do not, and a custom role has it
  only when the owner turns it on. It cannot be an "Ask first" tick (`canNeedApproval` is false: a
  two-minute hand-off cannot wait in Approvals).
- MCP and API tokens cannot call it (`customers.signInAs` is in `EXCLUDED_PATHS`).

## Flow

1. Admin `customers.signInAs({ id })` (`packages/api/src/routers/customer-sign-in-as.ts`) calls
   core `mintStaffSignIn` (`packages/core/src/shopper-login/staff-sign-in.ts`). It writes a
   `staff_sign_in` login ticket (random token, hash stored, 2 minutes, `impersonated_by` = staff
   user id) and a customer note for the timeline ("<staff> signed in to the store as this customer
   from the admin."). It returns `https://<store>/account/login/staff?token=…`. The activity log
   records the call on its own ("Customers: sign in as · <name>").
2. The confirm dialog opens the tab on the click, then sends it to that link (`open-status-page`
   pattern).
3. Storefront `/account/login/staff` spends the ticket (`redeemStaffSignIn`, deleted in the same
   statement, under store RLS). It starts a 1-hour `customer_session` with `impersonated_by` set,
   sets a browser-session cookie and a `wc_staff_as` marker cookie, then goes to `/account`.
4. While the marker is there, the layout looks up the session and shows the bar "Signed in as <name>
   by staff · Sign out" (`components/account/staff-sign-in-bar.tsx`). Sign out ends the session.

Why not the provider hand-off: `redeemHandoff` is bound to a cookie set in the browser that started
the sign-in on the store's domain. Here the admin domain starts it, so there is nothing to bind to.
The same ticket table is reused with the magic link's shape (single use, short-lived) and no
browser binding.

## Database

Migration `0262_customer_sign_in_as` is additive. It adds the nullable `impersonated_by` to
`customer_session` and to `customer_login_ticket`, and allows `staff_sign_in` in the ticket kind
check.

## Tests

- core `shopper-login/staff-sign-in.test.ts` and `permissions/statement.test.ts`
- api `test/customer-sign-in-as.test.ts`: the owner gets a link and a note, an administrator gets FORBIDDEN
- admin `components/customers/use-sign-in-as-customer.test.tsx`: the menu item shows only with the permission
