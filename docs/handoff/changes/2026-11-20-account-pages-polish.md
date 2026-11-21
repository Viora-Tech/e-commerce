# Account pages in the checkout's look, store credit on the account home

Branch `feat/account-pages-polish` (from `origin/dev`). Follows `3ce751ae1`, which already
moved sign-in, the order list and the order page to the checkout's look. This finishes the
rest of the signed-in account (roadmap Wed 25 Nov; backlog "Sign-in and order page redesign").

## What changed

- **Nav** (`account-nav.tsx`): Tailwind and `--ck-*` only, no more theme `account-nav__*`
  classes. On a phone the sections are pills that scroll sideways, and the open one is filled
  with the store's button colour. From `lg` they stack as a sidebar, and the open one is lit on
  the card. Icons per section, "Signed in as" with the name and email, and Sign out. All taps
  are 2.75rem or more. The layout keeps `account-layout` (it stops the theme's scroll reveal on
  headings), and its sidebar column now starts at `lg` to match the nav.
- **Page head** (`account-page-head.tsx`): one title, intro and action for Orders, Addresses,
  Profile, Store credit and Your data. Your data had no `<h1>` before.
- **Addresses**: cards in `ACCOUNT_CARD` with a staggered rise, the default first, and Edit,
  Set as default and Delete as icon text actions. The form uses `CheckoutField`,
  `CheckoutSelect` and a `CheckoutToggle` for "default", inside `CK_PANEL`. New
  `checkAddress()` catches a bad PIN code and a missing state before the server is called. The
  state select now has a blank first row, so this check is needed.
- **Profile**: the checkout's contact panel. Fields in wells, the phone picker styled as on
  sign-in, and the three offers as switches. Security (passkeys, connected accounts) is drawn as
  a card with row lists.
- **Store credit**: a balance card and a history card, with credits in the success colour.
  `describeStoreCredit` and `signedStoreCredit` are exported for tests.
  **New:** `StoreCreditSummary` shows at the top of the Orders page when the spendable balance
  (`spendableStoreCredit`) is above zero, and links to the history. This is item 7 of the
  17 Nov research. Recommendations were skipped.
- **Your data**: cards. Request states show as pills (`requestTone`). Delete account uses the
  danger button and the checkout's input for the code.
- Copy: new keys in `data/account.ts` (`nav.signedInAs`, `storeCredit.summary*`,
  `addresses.intro`, `addresses.stateRequired`, `profile.intro`, `profile.detailsTitle`).
- Colour classes that differ (the danger buttons, the active nav link) are swapped with
  `.replace()`, not stacked as a second `!` utility, because CSS order would then decide which
  colour wins.

All behaviour stays the same: the same server actions, confirm before delete, the deletion
code flow, passkey add and remove, and social connect. Sign-in and the guest order lookup were
not changed.

## Checks

- `vitest run src/components/account/`: 23 tests pass. The new file is
  `account-sections.test.ts`.
- Storefront `tsc --noEmit`: only the two known stale-module errors (snapmint,
  write-excel-file).

## Not done

- The return pages (`return-form`, `return-outcome`, `return-photos`, `return-timeline`) still
  use theme classes. The frame maps their colours to the `--ck-*` palette.
