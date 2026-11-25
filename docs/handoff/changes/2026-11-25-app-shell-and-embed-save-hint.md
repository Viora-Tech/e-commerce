# App pages: no title row, 3 sidebar pages, "Click Save" embed hint (25 Nov)

Owner asks while comparing Loyalty with Shopify's Essential Loyalty.

- `components/apps/app-shell.tsx`: no "‹ Apps / logo / name / status" row on any app page; the
  app's status pill, action and "…" menu (Settings, Uninstall) float top right with no gap, and
  the page content keeps `md:pr-12` so they never cover a page's own header buttons.
- `components/admin-sidebar.tsx`: an open app lists its first 3 pages, the rest behind "View
  more (n)" (`childLimit: 3`; the page on screen always shows). `nav-section.tsx`: View more uses
  the ⋯ icon, not a chevron.
- `components/themes/customize/embed-save-hint.tsx` (mounted in `apps-panel.tsx`): Customize
  opened with `?panel=apps&embed=<type>` switches that embed on, unsaved, and dims the canvas
  with "Click “Save” in the top right to switch on <app>" until clicked. Nothing is saved for the
  merchant. `lib/loyalty-placements.ts` `customizeHref(editor, kind, embed?)` builds the link;
  Loyalty's Program setup bar and Placements use it with `loyalty/Widget`.
- Loyalty pages sit in a centred 50rem column (tables stay full width).

Checked on localhost: Placements › Enable app embed opens Customize with the widget on and the
hint over the canvas; sidebar shows Home, Program, the open page, View more.
