# Settings layout audit, 11 November 2026

A pass over every page under `apps/admin/src/app/(admin)/settings/**` for the owner's complaint
on Settings › Staff › Roles: a second "‹ Staff" link under the page header, and a "Create role"
button alone on a row above the table. Paths below are under `apps/admin/src/`. Line numbers are
from `origin/dev` before this branch.

Staff (`components/staff/**`, `app/(admin)/settings/staff/**`) and Approvals are being changed by
another agent, so they are listed but not edited here.

## The root cause, shared by 16 pages

Most settings pages are a row list (Shopify's pattern, #147, `SettingsDrill`). Opening a row
kept the page's `PageHeader` ("Returns" and its subtitle) and drew a separate "‹ Returns" button
under it (`components/settings/settings-drill.tsx:83-91`), then the detail's own card repeated
the row's name as its title. So every open row showed three headings for one thing:

1. "Returns" (page header, with Save)
2. "‹ Returns" (drill back button)
3. "Online return requests" or "Returns" (card title)

Staff › Roles is the same thing plus a floating `flex justify-end` button row
(`components/staff/staff-settings.tsx:156-163`).

## Per page

| Page | File | What was inconsistent |
| --- | --- | --- |
| Store details | `components/settings/general-settings.tsx:173,183-194` | Drill back button under the header; root `gap-6` (most pages `gap-4`); completion card between header and rows. |
| Store health | `components/store-health/store-health-page.tsx:54,57,77` | Root is a fragment (takes the layout's `gap-6`); the intro was swapped out of the subtitle once checked and drawn again as a loose caption above the cards. |
| Domains | `components/domains/domains-settings.tsx` | Fine. Detail page (`domain-detail.tsx:242`) ends with a destructive "Remove" row outside a card, which is the usual place for a delete; left. |
| Locations | `components/settings/locations/locations-settings.tsx` | Fine: action in header, one list card. No empty state, but a store always has its default location. |
| Plan & billing | `components/billing/billing-page.tsx:132-182,184,203-211` | Drill back button under the header; "Payment" and "Downgrade" detail cards repeat the row name; Downgrade is a card holding only a `flex justify-end` button. Change plan (`change-plan-page.tsx:71`) `gap-5`. |
| Payments | `components/payments/payments-overview.tsx:156-179` | Drill back button under the header; `gap-5`. Provider page (`provider-page.tsx:105,134`) `gap-5`. Advanced (`payments/advanced/advanced-payments.tsx:152`) `gap-3` wrapper. |
| Checkout | `components/settings/checkout-settings.tsx:212-266` | Drill back button; Contact, Minimum order, COD, Form fields, Cart limit and Checkout content cards repeat the row name. |
| Shipping & delivery | `components/shipping-settings/shipping-page.tsx:161,171-197` | Drill back button; `gap-5`; courier status line stays on every detail (Notifications hides its own inside a row). |
| Returns | `components/settings/returns-settings.tsx:113,123-133` | Drill back button; `gap-6`; first card titled "Returns" under the "Returns" page header. |
| Printed documents | `components/documents/templates-list.tsx` | Fine. Template editor sub-page has one back link. |
| GST & invoices | `components/settings/taxes/taxes-gst-page.tsx:31`, `taxes-settings.tsx:201` | Header in the page, drill in the child, so an open row showed both the page header and the drill back button. |
| Costs for profit | `components/settings/costs/costs-settings.tsx:216,226-321` | Drill back button; `gap-6`; all four detail cards repeat the row name exactly. |
| Monthly expenses | `components/settings/expenses/monthly-expenses-settings.tsx:91` | `gap-6` only. Action in the header, empty state present. |
| Customer accounts | `components/settings/customer-accounts-settings.tsx:148-265` | Drill back button; Checkout, Sign-in and Deletion cards repeat the row name exactly. |
| Privacy & data requests | `components/settings/customer-privacy-settings.tsx:146-285` | Drill back button; all four cards repeat the row name. Requests queue and detail hardcode `/settings/privacy…` hrefs instead of `routes` (`privacy/data-request-queue.tsx:64,~100`, `privacy/data-request-detail.tsx:76`). |
| Policies | `components/settings/policies-settings.tsx:133-193` | Drill back button; disclaimer alert between header and rows; "Your policies" list and "Grievance officer" card repeat the row name; the "Edit store details" button floats in its own `flex justify-end pt-5` row inside the card instead of the card footer. |
| Notifications | `components/notifications/notifications-page.tsx:202,203-283` | Drill back button; `gap-5`; every detail starts with a hand-made `<h2>` + help that restates the row. |
| Staff | `components/staff/staff-settings.tsx:129-165` | The owner's example: drill back button under the header, floating "Create role" row. Not edited (other agent); see "How to adopt". |
| Approvals | `components/approvals/approvals-page.tsx` | Same drill back button. Not edited (approvals code is out of scope). |
| Activity log | `components/activity-log/activity-log-page.tsx:133,187` | `gap-5` only. |
| AI | `components/settings/ai-settings.tsx:163-181` | Drill back button; "AI is off" alert between header and rows; Features card repeats the row name. |
| MCP & API | `components/mcp/mcp-page.tsx:102-133` | Drill back button; the Activity link card stays under every open detail. Activity sub-page has one back link. |
| Custom data | `components/metaobjects/custom-data-settings.tsx`, `custom-data-owner-page.tsx` | Fine: one back link on the owner pages, empty and loading states present. |
| Appearance | `data/settings.ts:226` | The Settings menu row goes to `/account/appearance`, outside the settings layout (decided in #81). Left as is. |

## Navigation

- `SettingsSidebarNav.isActive` matches by prefix, so every sub-page (providers, advanced
  payments, zones, profiles, policies, templates, domains, locations, MCP activity, data
  requests, custom data owners, change plan) lights its parent row. No change needed.
- Phones: `SettingsNav` hides its "‹ Settings" link on sub-pages and on `?open=` rows, which
  both carry their own back link. With the header change an open row now shows exactly one.

## Loading and empty states

Every page has one: `settings/loading.tsx` (server pages) or a skeleton in the client component.
Lists with nothing in them show `EmptyState` (domains, expenses, custom data, data requests,
approvals). The loading skeleton now keeps the page title, so the header does not jump in.

## How a page adopts the one-header drill

```tsx
<SettingsDrill
  rows={rows}            // a row may add `help` (line under its title) and `actions` (header buttons)
  backLabel={copy.title}
  header={{ title, subtitle, actions, save, notice }}
  before={<HealthLine />} // first screen only, above the rows
  after={<SettingsList />} // first screen only, under the rows
>
```

Without `header` the drill behaves exactly as before (Staff, Approvals). For Staff › Roles:
pass `header`, and give the `roles` row `actions={<Button>Create role</Button>}` instead of the
`flex justify-end` row.
