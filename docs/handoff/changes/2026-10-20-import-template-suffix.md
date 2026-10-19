# Shopify import keeps each record's theme template; blog and article templates import

Branch `fix/import-template-suffix`. No migration (the `template_suffix` columns already exist).

- **Shopify import** (`packages/plugin-shopify-import`) now reads `templateSuffix` for products,
  collections, pages, articles and the article's blog, and saves it. Before, every imported
  record fell back to the default template, so a page on `page.about` lost the theme's about
  sections. `templateSuffix()` in `shopify-api.ts` keeps only suffixes our template keys allow
  (`^[a-z0-9-]{1,40}$`); anything else is the default. A CSV product row has no template column
  and leaves the product's suffix alone. Re-running an import fixes records imported earlier.
- **Theme import** (`packages/core/src/theme-import/import.ts`) now turns `blog` / `article`
  templates and their alternates into ours too (their main section becomes `MainBlog` /
  `MainArticle`, as for products). `IMPORTED_TEMPLATES` in `report.ts` counts them.
- **Liquid globals**: a blog's page gets `blog`, an article's page gets `blog` and `article`
  (`page-context.ts` `blogGlobals`), so the theme's own sections around our main one (an
  article's series list…) read them. The article is looked up among the blog's latest 50 posts.
- Left as is: `product.template_suffix` / `collection.template_suffix` in Liquid still read `''`.
