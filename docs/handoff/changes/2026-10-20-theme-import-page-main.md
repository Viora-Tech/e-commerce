# Imported page templates keep the theme's own main section

Branch `fix/theme-import-page-main`. No migration. Re-import the theme zip to apply.

- `toTemplateData` (`theme-import/import.ts`) replaced the first `main-*` section of every
  resource template with ours. On page templates that dropped the page itself: Waimers'
  `page.wishlist` main is the wishlist grid, and `page.reviews` main is the theme's styled title
  with breadcrumbs; ours showed a plain title or "Loading your wishlist…".
- Page templates now keep the theme's main section as a Liquid section (it reads `page.title` /
  `page.content`, which `PageDrop` has). Product, collection, blog, article and 404 still get ours.
- The import report marks a main section "replaced" only when it is used outside page templates.
