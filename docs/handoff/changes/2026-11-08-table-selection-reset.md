# Lists clear the selection on a tab, filter, search or page change

Every list on `ResourceTable` now clears its ticked rows (and the bulk bar) when the view in its
`ViewSelect`, a filter, the search text, the page or the rows per page change (#1295). Before, the
Orders bulk bar kept saying "1 order selected" after a switch from All to Unfulfilled.

- `table-state.ts`: `listScopeKey` (one string per set of shown rows) and `useClearOnChange`.
- `row-state.ts` (new): `useRowSelection`, `useExpanded` and `viewOf` moved out of `index.tsx` to
  keep it under the 500-line cap. `viewOf` reads the `value` of the `views` element.
- Lists with a controlled `selection` (Shipments) get `onChange([])` from the same reset.
- Tests: `bulk-bar.test.tsx` covers view, filter, search and page changes, and a plain re-render
  that keeps the selection.
