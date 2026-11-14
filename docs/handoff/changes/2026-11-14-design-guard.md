# Design guard (design audit step 17, 14 Nov 2026)

Branch `design/guard-design`. Audit section 6.2 step 17: stop the patterns the audit waves removed
from coming back. Details: `docs/guardrails.md` ("ac. design-guard" and "The no-restyle guard").

## `bun run lint:design`: no-restyle is an error for the shared parts

- `.oxlintrc.json` runs `no-restyle` a second time as `shadcn-guard/no-restyle` at **error** for
  the parts the audit settled (Button, DataCard, Card, Input, Textarea, Field parts, Skeleton,
  dialog parts, Table parts, SimpleTable, ResourceTable, Alert parts, Badge, StatusChip,
  EmptyState, PageHeader, PageBody, PageColumns, PillTabs, ToggleGroup, StatTile, RecordCombobox…).
  `shadcn/no-restyle` still warns for everything else. The second name comes from
  `scripts/lint/shadcn-guard.mjs` (oxlint sets severity per plugin name).
- 0 errors today. 26 files (shared table internals, glass and preview cards, borderless toolbar
  inputs, theme customizer, the product page files page pass 3 owns) are an override where the
  guard only warns; each has a reason in `docs/guardrails.md`.

## New sweep: `scripts/sweeps/design-guard.test.ts`

Bans in `apps/admin/src`: arbitrary `text-[…rem|px]` sizes, raw `text-xs/sm/base`, imports of
retired `components/kit/` parts (and new kit files), `rounded-2xl`/`rounded-3xl`, and the shadcn
`Badge`. Allow-lists with reasons for the named exceptions (checkout preview miniature, SVG text,
live-now figure, score ring, palette input, Preferences preview, theme customizer chrome, …).

## Stragglers fixed (no visual change)

- 66 raw sizes in 44 files: `text-sm` → `text-body` (same 0.875rem / 1.25rem), `text-xs` →
  `text-period` (same 0.75rem / 1rem), two `text-base leading-5 font-semibold` → `text-card-title
  leading-5 font-semibold` (same 1rem / 1.25rem / 600).
- `rounded-2xl` → `rounded-lg`: the dev email preview pages and the blocked-senders loading
  skeleton (now the same corners as the card it stands in for).

## Left for the page passes

Order page (`orders/customer-card`, `order-lines-table`, `payment-card`) and product page
(`products/variants-card`, plus the three product files on the lint override) are allow-listed
with "page pass owns it"; the page pass swaps the classes and removes the entries.
