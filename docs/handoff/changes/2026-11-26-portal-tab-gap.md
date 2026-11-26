# Affiliate portal: gap between tabs and between sidebar routes

Branch `fix/portal-tab-gap` (from `origin/main`, the live portal). No migration.

## What changed

Owner, on the live portal: "add gap b/w routes in tabs". Every tab-like nav in the portal now
has a 0.25rem (`gap-1`) gap between items, the same everywhere:

- Sidebar route lists (Pages and Account) in `components/affiliate-portal/portal-sidebar.tsx`:
  `<SidebarMenu className="gap-1">`. Official shadcn `SidebarMenu` has `gap-1`; our shared
  `packages/ui` one has `gap-0`, so the portal sets it locally (shared component untouched so
  admin does not shift).
- Status tabs on Commissions (`commissions-table.tsx`), Commission / Program tabs on the home
  balance card (`balance-tabs.tsx`) and the creative-type tabs on Marketing
  (`creatives-grid.tsx`): `TabsList` gets `gap-1`, so triggers no longer touch inside the
  muted pill.
- Settings sub-nav (`settings-nav.tsx`) already had `gap-1`; unchanged.
- The performance chart's range toggle (`performance-card.tsx`) is a joined outline group
  (`spacing={0}`, as in dashboard-01) and is left joined on purpose.

All paths are under `apps/storefront/src/`. Tailwind classes only, no other layout changed.

## Tests

- Class-only change; no tests added or run here.

## Left to do / for the owner to check

- On localhost: sidebar items, Commissions status tabs, home balance tabs and Marketing tabs
  show a small gap; tell us if you want it wider (`gap-2`, 0.5rem).
