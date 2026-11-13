# App layout v2 chrome (12 Nov 2026)

Figma App shell 638:2757 and the v2 app frames (928:10728 GST invoices, 928:11256 Delhivery,
928:11726 WhatsApp, 928:12095 Back in stock, 929:11373 Delivery options). Chrome only; the app
page bodies are untouched.

- **Compact app bar** (`components/apps/app-shell.tsx`): "Apps / <Name>" breadcrumb, 44 logo,
  name + status chip, the app's optional status pill, its one primary action (`HeaderAction`)
  and a "…" menu (`app-uninstall-button.tsx`) holding Settings (when the app has a settings
  page) and Uninstall, then a divider. The 72 logo, description, "Built with" credits line and
  the separate Settings button are gone (credits stay on the app's listing page). The
  Needs setup / Error banner is unchanged.
- **Sidebar**: every installed app is its own row in the Apps group (icon + chevron), after the
  Apps entry, in installed order; its pages nest under it while one is open, four then
  "View more (n)". Page counts show on the nested rows. The old "3 most recent + All apps + App
  Store" children and the recents store (`lib/recent-apps.ts`, `hooks/use-recent-apps.ts`,
  `components/nav-app-pages.tsx`) were removed. `NavItem` gained `base` and `childLimit`.
- **App bar hook**: `PluginManifest.appBar(ctx) → { statusPill?, pageCounts? }`
  (`@commerce/plugins` types `AppBarSummary`, `AppBarContext`). It runs inside the layout's one
  `store.shell` call (`services/app-bar.service.ts`), only for installed apps that declare it,
  each in a savepoint so a failure only hides the extras. Result: `store.shell.appBars` by app id;
  the layout turns `pageCounts` (keyed by manifest page path) into sidebar counts, the app page
  reads the pill. Statement cost: none for a store without such apps; per app with the hook,
  one statement plus SAVEPOINT/RELEASE.
- Wired: **GST invoices** (pill "GSTIN … · numbering 2026-27", Queue count of waiting drafts,
  counts only for `orders.read`) and **Delhivery** (pill "Last tracking update <n> ago", parcels
  in transit on the Overview row). Other apps adopt by adding `appBar` to their manifest.
- The app page (`apps/[pluginId]/[[...path]]`) now reads apps through the shared `store.shell`
  (`listApps`, `listAppBars`) instead of two separate `apps.list` calls (metadata + page).

## Checked and finished (13 Nov)

- Statement count per admin page, inside the existing `store.shell` transaction: 0 extra with no
  `appBar` app installed; 3 per installed app with the hook (SAVEPOINT, one select, RELEASE). The
  savepoint stays: a failed read without it would abort the shell transaction and break the page.
  Waimers with GST invoices and Delhivery installed: 6 extra statements, no extra round trip to
  the API (same call).
- An app row that nests its pages shows counts on the pages only ("Queue 6"), not again on its
  own row, as in the frame. A single-page app shows its count on its row.
- "View more (n)" moves keyboard focus to the first page it reveals (the button goes away).
- What still differs from the frames: the Delhivery pill reads "Last tracking update 3 min ago"
  (the frame adds "API key working ·"; the app bar read does not check the key, to stay one
  statement). Page order under an app follows its manifest (GST: Queue, Invoices, Returns,
  Products, then View more), not the frame's sample list.
