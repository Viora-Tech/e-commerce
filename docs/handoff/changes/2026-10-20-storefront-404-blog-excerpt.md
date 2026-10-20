# Themed 404 under imported themes; blog excerpts never show HTML tags

Branch `fix/storefront-404-blog-excerpt`. No migration.

## 404 page

- **Cause.** Next 16 answers a `notFound()` thrown outside a Suspense boundary with status 404
  and an empty error shell (`<html id="__next_error__">`): React cannot catch the error while
  rendering HTML, so the browser draws the page from the RSC payload. Our own block themes come
  through that intact (header and footer are React), only client-rendered. An imported Liquid
  theme does not: its markup travels only through the HTML render (`lib/liquid-slots.ts`) and its
  scripts only run when HTML is parsed, so the 404 showed bare, with no header, footer or CSS.
  Next's own docs: a real 404 status and a server-rendered page body do not go together.
- **Fix** (`apps/storefront/src/lib/themed-rerender.ts`). When a `LiquidSlot` finds no server
  markup in the document, the browser sets the `wc_rerender` cookie (a hash of the path, 60 s)
  and reloads once. With the cookie, the store layout wraps the page in `<Suspense>`: the
  not-found error stays inside it, the theme shell renders on the server as on every other
  page, and only the not-found section is drawn in the browser. First answer: 404 (crawlers,
  link checkers, curl). The reload: 200 with `robots: noindex`. A `wc_` cookie, so the edge
  cache never keeps it. `LiquidBoot` clears the cookie after a page draws; the slot checks the
  cookie first, so a page can never reload twice.
- `not-found.tsx` renders its template with `inlineLiquid` (new `TemplateOptions` flag; new
  `inline` prop on `LiquidHtml` / `DeferredLiquid`): the browser always draws the not-found
  boundary, so its imported sections must ride in the RSC payload.
- **Theme import** now imports Shopify's `404` template as our `not_found` (`RESOURCE_TEMPLATES`
  in `import.ts`, `IMPORTED_TEMPLATES` in `report.ts`): `main-404` becomes `MainNotFound`, the
  theme's other sections stay around it. Re-import a theme to pick it up.
- Not verified in a browser locally (needs the DB and a running storefront); check
  `/pages/this-does-not-exist` on the test server with an imported theme: one 404 then a 200
  reload showing header and footer, with the theme's scripts working.

## Blog excerpts

- **Cause.** Waimers' "Test" article has HTML source pasted into the editor as text (each tag
  is a literal paragraph). The card excerpt, built from the body, showed `<h2>…` verbatim; the
  meta description too.
- **Fix** (`packages/core/src/blog/text.ts`). `articleExcerpt` and the new `excerptText` read
  any text that contains HTML tags as HTML, so a stored excerpt with tags, or a body used in its
  place, always comes out as words. Render-time only: no data change. The Liquid
  `article.excerpt` (`theme-import/data.ts`) goes through `excerptText` before it is escaped.
- Left as is: that article's body still shows the pasted tags on its own page; it is what the
  merchant typed. Pasting HTML as rich text in the editor would be a separate feature.
