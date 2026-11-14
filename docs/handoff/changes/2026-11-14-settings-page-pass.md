# Settings page pass (design audit section 7, page pass 9)

Branch `design/page-settings` (from `origin/dev` 79a2f8681, wave 2 merged). Visual and UX
consistency only: no setting's meaning, saved data, permission or route changed.

## One card

- `settings/settings-card.tsx` is a `DataCard` now (title, help line as the DataCard grey line,
  footer). Settings cards get the DataCard measurements: padding 1.25rem (was 1.5rem), title line
  `text-card-title` 1rem/1.5rem (the size was already 1rem; line height was 1.375rem), 1rem from the
  title to the body (was 1.25rem). A card whose title repeats the open row's header still leaves
  the title out. Used by about 120 files, including Account and app settings pages.
- `layout/data-card.tsx` (shared): `title` is optional. A card with no title, line, action or
  count draws no header row and no top gap; a card with only a grey line has no 2.25rem minimum
  header height. Every existing caller passes a title, so nothing else moves.
- Hand-made settings cards moved to DataCard: the setup checklist on Settings home and the MCP
  status card. Section headings that were smaller than card titles are `text-card-title`: list
  cards (`SettingsList`), the Payments page sections (the heading used `text-card`, a colour, so it
  fell back to body size) and the role editor's Permissions heading.

## One table

- `settings/settings-table.tsx` is a DataCard (`flush`) with a `SimpleTable`: the list table's
  2.5rem header with 0.75rem muted labels and 3.75rem rows (were a 2.5rem header with 0.8125rem
  labels and 3rem rows). The heading is the card title (1rem, was 0.875rem). Column options,
  `actions`, `after`, `footer` and `total` work as before. `SettingsTableCell` keeps the body text
  size; row height and sides come from the table. Shared outside settings: catalogs, markets,
  rollouts, preorders, inbox knowledge, quick replies and blocked senders use it too.

## One save pattern

- The floating save bar is the one save. The header Save that sat next to it is gone from Store
  details, Checkout, Payments advanced (and the other `ProviderSettingsForm` pages: file storage,
  message channel connect), Returns, Taxes & GST, Costs for profit, Customer accounts, Privacy,
  Policies, AI, MCP & API, Shipping & delivery, new shipping profile and new delivery area. Each
  page's save, discard, validation and leave guard are the bar's, which were already there.
- `SettingsDrill`'s `header.save` and the Taxes `onSaveState` plumbing that fed the header button
  are removed (no callers left).
- Card-level saves (accent colour, location cards, COD, gateways, pre-order cards when on their
  own) are a different pattern (a button that saves only that card) and stay.

## Loading

- `SectionPageSkeleton` (shared) has `rows`: one row-list card, the first screen of a drill page.
  `components/settings/settings-skeleton-rows.ts` holds each page's row count; the new route
  loaders (ai, appearance, approvals, checkout, costs, customer accounts, MCP, notifications,
  policies, privacy, returns, shipping, staff, store, taxes) and the pages themselves draw the
  same shape, so the screen does not swap a two-card picture for a row list. Child routes that
  are forms (policy editor, shipping profiles and zones, roles, privacy requests, MCP activity)
  get their own form loader so they do not inherit the row list. The policy editor's loader
  matches its 1 card x 4 fields.

## Fields and tabs

- Text fields with hand-made `Label` + div are `Field` + `FieldLabel` (0.75rem labels like every
  other settings field): connect domain (with `FieldError`), create API token (name, access,
  expiry), invite member (email, role), role editor (name, description).
- Section tabs were already PillTabs (wave 2); their label now reads the member's language.
- Inputs are all 2.25rem (the default since #1688).

## Left alone

- `size="lg"` vs default inputs (both 2.25rem; lg has 0.8125rem text): a shared-variant decision.
- The staff table's role select stays 2rem (a dense control inside a row).
- Approvals' load failure is a plain line, not `LoadFailed`; pages without a drill (billing,
  domains, locations, templates, store health, custom data, activity) keep the default loader.
