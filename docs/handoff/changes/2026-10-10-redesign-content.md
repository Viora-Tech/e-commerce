# Admin redesign: Content

Branch `feat/proofly-content`. Proofly look for the Content area (Figma `YmMNC5JOimqg61sI0eFI5a`,
section "Content"). Presentation only: no data, permission, API or migration changes.

## What changed
- **Sidebar:** Content now lists Pages, Blog posts, Files, Menus, Content types (as in the design).
  Pages and the old Blog URLs keep working; `/online-store/pages/**` highlights Content, not Online
  store (`NavItem.excludes`, and a section is active when one of its children is).
- **Hub** (`/content`): four cards (Files, Content types, Menus, Blog posts) with a plain-words count
  each, "Go to pages" key button. A card without permission or data simply has no count line.
- **Lists** on `ProoflyListPage` with tabs, search, rows-per-page, centred status chips, friendly dates:
  Pages (All / Published / Hidden, template column), Blog posts (rows per page now in the URL and read
  on the server), Files (tile grid with name and "JPG · 1.2 MB", All / Images / Videos tabs, Upload
  files button), Menus (links, used in, status; "Header and footer" opens the storefront navigation
  sheet that used to be a side card), Redirects, Content types, Entries.
- **Editors** on `ProoflyDetailPage`: page, blog post, blogs manager, menu (name and handle card,
  live preview, Delete menu), content type definition, entry, new content type.
- **Copy:** every touched screen reads `useCopy`; Hindi in `data/hi/content.ts`, `content-blog.ts`,
  `content-files.ts` and `data/hi/metaobjects.ts`. Picker and storage hints in `mediaContent` stay
  English (`untranslated`).
- **Routes:** hardcoded hrefs in these screens moved to `routes.*`; the `admin-routes` allow-list went
  down by 14 files, one `date-format` entry left the allow-list.

## Not done, and why
- Files "Storage" screen (usage bar, largest files): no usage or plan-limit data exists, so only the
  existing storage provider form is shown. The "2.1 GB of 5 GB used" line and Documents tab are hidden
  (media has no document type yet).
- Pages "Import" button, entries Active/Draft tabs, "Shown on" column: no data behind them.
- Blog posts "Category" column uses the blog's name; the Figma "Updated" is "Published" (the list
  query has no updated date).
- Not checked in a browser (no local login in this environment).
