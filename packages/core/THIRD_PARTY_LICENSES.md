# Third-party licences: @commerce/core

See the root [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) for the index.

## Shopify Product Taxonomy (MIT)

Source: https://github.com/Shopify/product-taxonomy

What we adapted: the category list from release `v2026-08`, trimmed to `[id, name]` pairs
(attributes, values and return reasons dropped; breadcrumbs are rebuilt from the hierarchical
ids at load time) by `scripts/trim-product-taxonomy.ts`, vendored at
`src/catalog/product-taxonomy.json`. The admin searches it for the product category picker
(`apps/admin/src/lib/product-taxonomy.ts`); `src/dynamic-sources/service.ts` names a product's
category from it for the theme editor's `product.category` source. No code was copied,
only the generated category data. Licence text as in the upstream `LICENSE` file:

```text
Copyright (c) Shopify

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
