# GST Queue page header: one row, one "…" menu

Owner, 28 Nov 2026: the Queue header "doesn't look good" (two "…" menus, Issue N invoices
twice, the GSTIN pill squeezed between buttons, mixed button styles).

## What changed

- **Before**: page "…" (Add orders by number) and "Issue N invoices" from the page, then the
  app shell's floating GSTIN pill, "Export GSTR-1" and a second ghost "…" (Settings, Uninstall).
- **After** (left to right on the right side): "Export GSTR-1 ⌄" (outline), one outline "…"
  More actions menu, then the primary "Issue all N invoices". All three are 2.25rem high.
- The More actions menu holds: Add orders by number, then (rule) Settings, Uninstall.
- "Issue all N invoices" shows only while no row is ticked; with rows ticked the table's bulk
  bar owns Issue (like Orders, whose header keeps the list-wide actions and the bulk bar the
  ticked rows' ones). The ticked-rows path was removed from the header's handler.
- GSTIN and numbering are a small meta line under the description:
  "GSTIN 06… · Numbering 2026-27" (or "No GSTIN yet · Numbering 2026-27"), read from the
  app's settings the page already loads. Copy in `data/gst-queue-page.ts` with Hindi.

## How

- New registry flag `ownHeader` (`apps/admin/src/apps/registry.ts`): pages listed there draw
  the app's actions in their own header, so `AppShell` floats none (no pill, no HeaderAction,
  no app "…"). GST invoices sets `ownHeader: ['']` (Queue only; the other GST tabs keep the
  shell's row).
- `AppShellContext` / `useAppShell` (`components/apps/app-shell-context.tsx`) hands the page
  the app id, name and settings link; `AppUninstallButton` takes the page's `items`, a `label`
  and an `outline` variant, so the merged menu reuses its Settings and Uninstall confirmation.

## Checks

biome on changed files, admin typecheck, lint:components (223, baseline), vitest
`src/components/apps/gst-invoices` + `src/lib/i18n.test.ts` (28 passed). Not checked in a
browser; the owner checks on localhost.

## GSTIN fallback (follow-up commit)

The meta line keeps the old chip's fallback: the app's seller GSTIN, else the store's own GSTIN
(Settings › Store details); "No GSTIN yet" only when both are blank. `gstInvoices.settings.get`
now also returns `storeGstin` (`storeGstin` in `packages/api/src/services/gst-invoices.service.ts`),
and the choice is the pure `headerGstin` in `components/apps/gst-invoices/queue-meta.ts`, with
`queue-meta.test.ts`. The "add your GSTIN" checklist still reads the app's seller GSTIN only,
as before.
