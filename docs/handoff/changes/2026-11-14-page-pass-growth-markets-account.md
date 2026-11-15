# Page pass 15: Growth, markets, catalogs, rollouts and account

Audit section 7, row 15 (`/growth/*`, `/markets/*` with catalogs and rollouts, `/account/*`), plus
two leftovers: the campaign visual builder popup (audit 3.3 item 13) and the hand-built tables in
growth, billing and account. Visual and state consistency only: every campaign, automation,
market, catalog price, rollout and account or billing action does what it did before.

## Already in place (checked, left alone)

- Every page in scope is on PageBody or ProoflyListPage with PageHeader (wave 1 removed the
  hand-copied shells in the campaign editor, report, links and automation editor); the market,
  catalog and rollout forms use the 52rem `form` width.
- Rollout confirm tones were already fixed (Start now, Ship, Keep: `tone="default"`).
- Account pages already had failure states; the `(admin)/account` skeleton is the shared
  SectionPageSkeleton (the two-skeleton issue belongs to the settings step).

## Campaign visual builder

- On the dialog shell at `size="full"` (was a hand-made full-screen div portalled to the body):
  Esc and the X close it, focus stays inside, the title is the dialog's title.
- Dirty guard: once the canvas has changes (GrapesJS's dirty count), Esc or the X ask "Discard
  what you typed?" first. Cancel still asks with the builder's own "Leave without saving?", Save
  design still saves and closes. There is no async save in the builder, so `busy` stays off.
- The chunk loads inside the dialog (spinner in the dialog, not a separate full-screen div).
- GrapesJS's colour picker opens inside the editor (was appended to the body, which a modal
  dialog would treat as a click outside and pull focus back from).
- A failed brand read shows "Could not load the builder" with Try again (was a spinner forever).

## Tables moved to SimpleTable (10)

Top campaigns, Sales by source (expandable rows kept), Sales by channel (filter in the card
header), Recent campaigns (Growth overview), Tracked campaigns, Campaign links, A/B results
(compact), Compare plans, Per-order fee bills and Invoices (was a grid list; new column names
`billing.bills.columns` + Hindi). Same columns, alignment, links and actions; header and row
heights now match the main lists. The attribution cards around them are DataCards (funnel,
sources, channels, top campaigns, credit model). The Growth overview cards keep their own look
on purpose.

## Failed loads ("Could not load … Try again")

- Growth overview and Attribution: a failed read for new dates says so in place of the figures
  (was: the old range's numbers stayed). Shared `growth/use-overview-range.ts`.
- Tracking links: a failed read shows "Could not load links" inside the table (was a spinner
  forever); the totals read no longer throws unhandled.
- Account: profile, notifications, security, sessions, stores and bug reports use the shared
  PageState with "Could not load your …" (was a hand-made card); passkeys show Try again
  instead of "no passkeys" when the list fails.
- Catalog price table: Try again on a failed read (was red text only).

## Pages

- Campaigns list: empty state is EmptyState `page`; skeleton draws the back link, two buttons, the
  Campaigns | Tracking links tabs and the real campaign columns. Automations list: real columns.
- Campaign report: Unschedule/Stop and Duplicate spin on their own button (Duplicate no longer
  sticks when the request fails); scheduled and failed-sends notes are Alert `info`/`warning`;
  "no orders yet" is EmptyState; side column 23.5rem, 1.5rem gaps.
- Campaign editor: the two notices are Alert `warning`; 1.5rem gaps; the visual-builder card is a
  DataCard. Send dialog radios are Field + FieldLabel.
- Automations templates: Use spins on the pressed tile. Recommendations: Dismiss spins.
  Autopilot: Dismiss spins; empty proposals is EmptyState.
- Markets: the market and new-market pages use DataCards (name card, Customized) instead of a
  `rounded-xl` box; the countries row label is FieldLabel. Graph note radius `rounded-lg`.
- Markets, Catalogs, Rollouts lists: their own skeleton (title, the tabs/switch bar and the
  settings table with the real columns), new `markets/markets-area-skeleton.tsx`. Catalogs'
  "none in this tab" line sits in the table as EmptyState. Detail/new loaders draw the back link,
  the real button count and card count.
- Catalog page: search is SearchField; switch row is Field. Rollouts: radio and checkbox labels
  are Field; error banner `tone="danger"`, conflicts banner `danger`/`warning`; Resume spins;
  "Ship treatment" / "Keep control" in sentence case; Add changes closes with "Close".
- Account: 1.5rem rhythm between cards (was 1rem).

## Shared files touched

- `components/layout/detail-page-skeleton.tsx`: the `narrow` frame drops its `gap-4` so it has
  PageBody's 1.5rem like the loaded form. Only market, catalog and rollout loaders use `narrow`.
- `components/account/avatar-field.tsx`, `components/growth/best-source-callout.tsx`: the same
  one-token swap the design-guard branch makes (`text-sm` → `text-body`, `text-xs` →
  `text-period`), so the guard passes here and the merge is clean.

## Left alone

- Markets, catalogs and rollouts lists keep the settings table (`settings/settings-table.tsx`,
  a settings component; moving it to SimpleTable is the settings pass's call).
- Growth overview cards (hero, autopilot strip, top sources, search, sessions, channels, traffic
  types, attributed sales) keep their raw cards: the guard allows them.
- Campaign email content card and WhatsApp template card (allowed by the guard), the automation
  editor's own top bar (editor chrome), bug report rows and billing apps rows (rich list rows,
  not tables).
- Account `loading.tsx` is still SectionPageSkeleton, then the page's own skeleton (settings step).
