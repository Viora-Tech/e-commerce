# Menu link types, broken-link check, redirects on handle change, redirects CSV (CMS PR5)

- **Menu items** can link to a blog, a blog post (`blog/post`), a policy, the search page and
  all collections (`NAVIGATION_ITEM_TYPES` in core `navigation/items.ts`; `itemPath` in
  `resolve.ts`; `NavigationItemType` in db). No migration (menus are JSON).
- **Broken-link check**: `menuLinkProblems` (core `navigation/link-check.ts`), API
  `navigation.checkLinks`; the admin menu editor shows a banner and a mark per item, rechecking
  as you edit.
- **Handle changes**: `onHandleChange` (core `redirects/handle-change.ts`) adds an `auto` redirect
  old → new, flattens chains, drops a redirect from the new path, and moves menu items. Wired into
  core `updateProduct`, `updateCollection`, the API product patch and `updatePage` (both API
  services now take `storeId`). `url_redirect.source` gains `auto` (text column, no migration).
- **Redirects CSV**: `redirects.exportCsv` / `redirects.importCsv` (dry-run preview), Shopify's
  two columns, line-numbered problems (core `redirects/csv.ts`, `importRedirectsCsv`).
- Docs: merchant guide "Menus and URL redirects" (new), developer "Menus and redirects" (new).
