# 2026-10-31 — Settings pages in the row list + detail pattern (#147)

Every settings page now looks and behaves like Checkout, Store details and Customer accounts
(see `2026-10-30-settings-shell-home-cards.md`): a short list of rows with their current value
and a ›, each opening its detail in place (`?open=<row>`, old `#anchor` links open the row of
that id). Only the layout changed; every form, dialog, save bar and permission check is the same.

## Row list + detail (`SettingsDrill`)

| Page | Rows (`?open=`) |
| --- | --- |
| Taxes & GST | `gst-numbers`, `registration`, `charging` (with the explainer), `invoice-numbers`, `e-invoice`. The three tabs are gone; a row reads "Needs a fix" when a field in it fails validation. |
| Notifications | `messages` (customer messages, "12 of 15 on"), `you`, `sender`, `how-messages-are-sent`, `advanced` (dev only). The status line stays on top. |
| Policies | `policies` (the five policies as link rows), `business`, `grievance` |
| Returns | `requests`, `reasons`, `rules` (exchanges and auto-approval), `refund` |
| Privacy & data requests | `banner`, `requests`, `grievance`, `accounts` |
| Staff | `members`, `invites`, `roles` (tabs gone; Invite moved to the page header) |
| AI | `usage`, `features`, `privacy`, `activity` |
| Appearance (Settings and Account) | `mode`, `accent` (with the store default), `layout` (Account only) |
| Costs for profit | `methods`, `gateways`, `delivery`, `cod-fee` |
| MCP & API | status card on top, then `connect`, `apps`, `permissions`, `tokens`; a link row to Activity |
| Plan & billing | plan card and banners on top, then `payment`, `apps`, `invoices`, `fee-bills`, `downgrade` |
| Approvals | `waiting`, `mine` |

## Lists as rows in a card

New `components/settings/settings-list.tsx` (card, heading, rows split by hairlines, `after`
and right-aligned `footer`) and `settings-link-row.tsx` (title, quiet line, value, ›; a link, a
button with `onClick`, or plain). Used by **Locations** (drag grip kept, the row opens the
location), **Domains**, **Custom data** (both lists) and **Monthly expenses** (a row opens the
edit dialog, delete stays at the row end), and inside Policies and MCP.

## Copy and links

- Row titles and values: `data/settings-rows.ts`, Hindi in `data/hi/settings-rows.ts`.
- Search entries, `routes.settings.staffRoles()` (`?open=roles`), `privacyBanner()`
  (`?open=banner`), the grievance links, the GST numbers links (Locations, Registration) and the
  COD fee link now use `?open=`. `lib/settings-search.test.ts` follows.

## Not changed

- **Payments** (another branch is revamping it) and **Store health** (a list of problems with fix
  buttons; it already reads as rows).
- Shipping: see the commit log of this branch; it waits for the shipping zones work.

## Test

Open each page under Settings: it shows rows with values; click a row, the URL gets `?open=`,
"‹ Page" goes back; edit something in a detail, go back, the save bar is still there and the
row value has changed. Try `/settings/policies#grievance` and `/settings/taxes?open=charging`.
