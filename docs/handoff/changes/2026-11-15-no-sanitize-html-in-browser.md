# sanitize-html no longer ships to the browser: 64 kB gzip off every store page

`sanitize-html` and its parser (htmlparser2, postcss) were in the store layout's first-load JS on
every storefront route (chunk of 64.7 kB gzip), not only product pages: client sections drew body
copy with `RichCopy` (`packages/blocks/src/components/rich-copy.tsx`), which called
`richtextHtml` and so imported the sanitiser into the client graph (newsletter, FAQ accordion,
newsletter band, cookie banner, carousel slide, hero copy via video and spotlight heroes, and the
buy box's accordions and offer panel through the client `ProductView`).

**Change: sanitise on the server, draw the result in the browser.**
- `richtext-node.ts` (new): `richtextNode(value)` runs stored copy through the unchanged
  `richtextHtml` allow-list and wraps it as a `RichHtml` element (`components/rich-html.tsx`, a
  small client component). Blank strings and editor nodes pass through. `mainProductRichtext` and
  `productFieldsRichtext` do the same for the buy box; `isBlankRichtext` for "is there copy".
- `sections/richtext-props.ts` (new), called by `framed()`: every section's `richtext` fields, in
  arrays and objects too, become those elements before the section renders. Sections already
  took these props as React nodes (Puck's inline editor), so their code did not change.
- Storefront: the product page prepares `MainProduct`'s settings and the product's fields
  (`mainProductRichtext`, `productFieldsRichtext`); the store layout the cookie banner's message.
- `RichCopy` imports no sanitiser. A `RichHtml` element is drawn with RichCopy's class (on the
  element, or through `RichCopyScope` when it reaches a client section as a lazy reference, which is
  how React delivers a server element there). Stored strings go through `storedRichtextHtml`
  (`richtext-text.ts`, new): `richtextHtml` where `richtext-html.ts` is loaded (it registers itself:
  server, admin canvas, Hono island, which imports it in `buy-box.tsx`); without it the text is
  shown escaped, never the markup. `richtext-html.ts` is listed in the package's `sideEffects` so
  the registration is never tree-shaken away.
- Saved data cannot forge sanitised copy: it is JSON, and only a React element is trusted.

**Numbers** (`bun scripts/perf/first-load-js.ts apps/storefront`, gzip, production build):

| Route | Before | After |
| --- | --- | --- |
| Product page | 382.9 kB | 318.5 kB |
| Store home and every `/-s/[storeId]` route | | −64.3 to −64.4 kB each (37 routes) |
| Cart | 362.1 kB | 297.8 kB |
| Checkout | 524.5 kB | 460.1 kB |
| Custom domain catch-all `/-c/[storeId]` | 331.1 kB | 266.7 kB |

sanitize-html is now only in a lazily loaded chunk the theme preview bridge fetches inside the
Customize frame (`@commerce/core/theme`), which no shopper downloads; a browser run of three pages
fetched it zero times.

**Same output.** Saved before/after HTML of eight Waimers pages (home, three collections, three
product pages with accordions, search) and compared the markup a shopper sees: identical, apart from
the home page's random "perfect match" picks, which differ between two renders of the same build.
Playwright on two product pages and the home page: no console or hydration errors.
`packages/blocks/test/richtext-server.test.tsx`: for twelve stored values (plain strings, Puck HTML,
script/handler/`javascript:`/`data:`/protocol-relative/svg/iframe/style payloads, Lexical JSON as
string and object) RichCopy draws exactly what it drew before, from both the server element and the
stored value; nothing executable gets through; richtext fields are sanitised at every depth and other
fields are untouched; the FAQ accordion section draws its sanitised intro; the buy box's offer panel
and accordions are sanitised; and no `'use client'` module in the package reaches `sanitize-html`
through its imports. `richtext-text.test.ts`: without the sanitiser, stored HTML is shown as text.

**Note for new code.** A client component that draws merchant HTML gets a `richtextNode` element from
its server parent; never import `richtext-html.ts` into a client module.
