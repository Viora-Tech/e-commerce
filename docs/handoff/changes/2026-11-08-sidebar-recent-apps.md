# Sidebar: the 3 most recent apps; app side menu only for big apps

- Apps in the sidebar: instead of the first five installed apps, the three this member used most
  recently in this store, the app on screen first, then "All apps (n)" and the App Store link.
  Recents live in this browser (`localStorage`, key `admin-recent-apps:v1:<storeId>`, like
  `media-recent.ts`): `lib/recent-apps.ts` (pure helpers, tested) and `hooks/use-recent-apps.ts`
  (guarded reads and writes). With no history it falls back to installed order.
- Inside an app (`AppShell`): the left sub-menu shows only for apps with 3 or more pages. A
  two-page app whose second page is its settings reaches it from the header's Settings shortcut;
  any other two-page app keeps the menu so no page becomes unreachable. One-page apps are as
  before.
- "Ready to ship" and "Ready for pickup" are no longer in the left sidebar on `dev` (they are
  tabs on the Shipments page); nothing to remove.
