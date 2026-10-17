# Installed apps page, declared app access, connect-first install

Branch `feat/apps-installed`. Migration `0124_app_installation` (table `app_installation`, RLS).

- **Apps (`/apps`) lists only installed apps** (Figma "Installed apps · List"): status pills and
  view select (Connected / Needs setup / Error), search, Can access, install date, last
  activity, row menu, bulk uninstall, permissions sheet. Code: `components/apps/installed/`.
- **The App Store moved to `/apps/store`** (the old gallery, without its Installed strip). Owner's
  plan: a public store on the landing site later; then "Browse App Store" points there.
- **Install flow** `components/apps/install/`: Connect account → Permissions → Done for a courier
  or key gateway (`apps.connectForm` / `apps.testConnection`; `apps.install` saves the account in
  the same transaction); other apps go Permissions → Done. **`/apps/install?app=<pluginId>`** opens
  it for the store the member is in: the entry point for an outside app store.
- **Declared access**: every manifest has a required `access` (resources with read/write level and
  why, a summary, data shared with the outside service); Search Console and Umami add
  `setupState`. Developer docs: building/plugins.mdx → "`access`".
- **Status** (`packages/api/src/services/installed-apps.service.ts`): connected = provider enabled
  (or the app's own `setupState`); error = a recorded failure in `app_installation.last_error`
  (hook or job failing for good, cleared by the next good run) or the app's own problem
  (Search Console access expired / last sync failed).
- **Last activity**: hooks and jobs (`ctx.reportActivity`), courier bookings, gateway captures.
- App pages: Needs setup / Error banner in the app shell, ⋯ menu "All installed apps", courier
  Connect side cards, Overview ticks and webhook address, Back in stock / Search Console / Forms
  layout per Figma.

Not done: app sub-navigation stays the left rail (Figma shows top tabs; the rail was chosen on
2026-10-11); Razorpay/Cashfree connect keeps the shared Settings › Payments gateway flow.
