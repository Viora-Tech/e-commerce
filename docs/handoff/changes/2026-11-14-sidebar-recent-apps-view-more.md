# Sidebar Apps: three recent apps, then View more; app menus back inside the app

- Owner, 14 Nov 2026: the Apps group lists only the three apps this member opened most recently
  (plain links, nothing nested under them), then **View more** to the full apps list. With no
  app installed it keeps its one Apps link.
- Each app's pages are its own menu beside the page again on desktop too (`app-shell.tsx`),
  as before 11 Nov; phones keep the row of tabs.
- Copy: `navigation.ts` `viewMoreApps` (Hindi: और देखें) replaces `allApps`.
