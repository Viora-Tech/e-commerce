# Product → collections "Input validation failed" (#804), one bulk bar (#808)

## #804 root cause

The product page's Organisation column has a Collections card (`ProductCollectionsCard` →
`ProductCollectionsField`). Its "Add to collection" picker was a Base UI `Select` held at
`value=""`. When a collection is picked it leaves the `available` list, so the Select's item
map changes; Base UI 1.8 then finds the controlled value (`""`) among no items and calls
`onValueChange(null)` (`SelectPositioner` `onMapChange`). The handler did `String(id)`, so
`"null"` joined the picked ids (the chip list hid it, as it matches no option). Save sent
`collectionIds: ['<real id>', 'null']`, and `collections.setForProduct`'s `z.uuid()` rejected
it: oRPC's bare "Input validation failed". Nothing about the product (draft, no options, no
stock, no vendor) mattered; the server path was fine.

Fix:
- `components/products/collection-pick.ts`: `withCollection` only adds a string id that is
  one of the offered collections; `collectionIdsToSave` filters the save to offered ids.
- The picker Select is now `value={null}` (Base UI's "no value"), which skips that branch.
- Tests: `packages/api/test/collections-product.test.ts` (draft product joins/leaves manual
  collections; `'null'` is turned down with an issue at `collectionIds.1`),
  `collection-pick.test.ts`.

## Readable validation errors (all admin calls)

`lib/api-client.ts` adds an oRPC client interceptor: an "Input validation failed" error gets
a message naming the fields and why (`describeValidation` in `lib/api-errors.ts`, copy
`validationContent` in `data/common.ts` + Hindi), e.g. "Collections (item 2): not a valid
ID". Every `toast.error(err.message)` benefits; `data.issues` is untouched, so the product
form's own `saveErrorMessage` still works. `createApiClient` takes optional interceptors.

## The two glitches on the #804 screenshot

Both are artefacts of the "Report a bug" picture (modern-screenshot), not the live page:
- Empty image tiles: the CDN answers a plain `<img>` load without
  `Access-Control-Allow-Origin` (it only sends it when the request has `Origin`), and the
  library fetched images cache-first, reused that copy and failed CORS. `capture-page.ts`
  now bypasses the cache for other hosts. The image itself is fine (2048² PNG). The product
  gallery tile also gets a "Can't show this file" state if an image really fails to load.
- "Draft" over "No options": the clone fixes each box's height; sub-pixel width drift wrapped
  the chip onto a second row of a one-row-high box. `PageHeader` keeps title and chips on one
  line (title truncates, full title in `title`).

## #808: bulk actions shown twice

`ResourceTable` rendered `bulkActions` in both the header selection bar and the floating bar.
Now the floating bar holds `bulkActions`; the header shows only the selection (count, Select
all, Clear) plus an optional `bulkMore` ⋯ menu. Products: floating bar = Bulk edit, Set as
active, Set as draft, Add tag, Add to collection, Delete; ⋯ = Write with AI, Archive, Export,
Run automation (`ProductBulkMore`). Every other list keeps its actions in the floating bar.
