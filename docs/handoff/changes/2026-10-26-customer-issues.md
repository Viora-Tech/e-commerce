# Customer page fixes: clipped side cards, address book, Add customer (#671, #672, #665)

Branch `fix/customer-issues-2026-10-26`. No migration.

## #671 Side cards clipped on the customer page

Cause: commit 8bca9405 (21 Oct) made the detail pages' right column sticky. It became a flex
column capped at the screen's height (`lg:max-h-[calc(100dvh-6rem)]` + `overflow-y-auto`). The
Card primitive has `overflow-hidden`, and that makes a flex item's minimum height zero. So the
browser shrank every card to fit the column and cut off their content: Contact's email row,
the address, the consent text. 34b9d48f (22 Oct, after the report) added `[&>*]:shrink-0` to
each of the three copies of that class string.

This PR moves the three copies into one component,
`apps/admin/src/components/layout/sticky-side-column.tsx`, with the no-shrink rule and a
comment saying why. `PageColumns` (customers and the other Saleor-style detail pages),
`OrderPageFrame` (order detail) and `ProoflyDetailPage` (product detail and the other Proofly
frames) all use it now. The cards' own classes did not cause the bug: they have no fixed `h-*`,
and `DataCard`'s `h-full` resolves to auto inside a column with no fixed height.

## #672 Address book

The address book (`customer_address`, core `accounts/addresses.ts`) already handled several
addresses, add and edit in a centred dialog, and delete with a confirm. In the bug report the
Edit and Delete buttons sat under the part #671 cut off. New in this PR:

- `customers.setDefaultAddress` (oRPC, `CUSTOMERS_WRITE`) wraps the existing core
  `setDefaultAddress`.
- Each saved address that is not the default gets a "Set as default" button on the card.

## #665 Add customer

- Core `createCustomer` (`packages/core/src/customers/create.ts`). It needs an email or a
  mobile number and checks every field before writing. It refuses an email (case-insensitive)
  or mobile another customer already has and returns that customer's id. The mobile match uses
  the blind index, and the plain value on rows the backfill has not reached, with or without
  the 91 prefix. The phone is stored encrypted. An optional first address becomes the default.
  Consent goes through `setMarketingConsent` (source `admin`, staff actor). The function also
  writes `customer.created` and `customer.tags_changed`.
- `customers.create` (oRPC, `CUSTOMERS_WRITE`): a duplicate is a `CONFLICT` with
  `data.field` and `data.existingId`, a bad field is a `BAD_REQUEST` with `data.errors`. The MCP
  action docs are regenerated.
- On `/customers`, an "Add customer" primary button sits at the top right (Segments is now
  outline). It opens a centred dialog, `components/customers/new-customer-dialog.tsx`, with
  name, email, mobile (+91), an optional address, consent per channel, a note and
  comma-separated tags. `?new=true` opens it, and the `N` shortcut goes there. On save it goes
  to the new customer. On a duplicate, the field shows a link to the existing customer.
- Copy: `data/new-customer.ts`, with its Hindi overlay in `data/hi/customers.ts`.

Tests: `packages/core/src/customers/create.test.ts` (DB).
