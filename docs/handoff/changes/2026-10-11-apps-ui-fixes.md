# Apps UI fixes (2026-10-11)

- Sidebar Apps group now lists every installed app (not only ones with pages). Apps without pages
  (storage providers like R2/S3) link to the settings page of the kind they provide
  (`appEntryHref` in `apps/admin/src/lib/apps-gallery.ts`, fed from `(admin)/layout.tsx`).
- Apps catalog: installed apps stay in the App Store grid with an "Installed" badge, Open and the
  uninstall menu. New status chips All / Installed / Not installed. Category and "Built by" counts
  now cover all apps.
- `AppShell`: the top tab strip is replaced by `AppNav`, a Settings-style left sub-nav (horizontal
  scroll row on phones). Shown when an app has more than one tab; content takes the full width.
  Routes are unchanged.
- Shopify importer: removed the `max-w-3xl` caps on the connect tab; CSV and credentials two-column
  layouts stretch so both columns share top and bottom (no `items-start` / sticky).
