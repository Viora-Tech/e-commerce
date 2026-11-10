# Back undoes list filters instead of leaving the page (#1479)

- `apps/admin/src/app/layout.tsx`: `NuqsAdapter defaultOptions={{ history: 'push' }}`, so tab,
  filter, sort and page changes on every admin list add a history entry and Back undoes them.
- Search boxes on URL-state lists (`onQueryChange`) pass `{ history: 'replace' }`: one entry per
  search, not one per letter.
- Shipped without a manual click-through (owner asked for speed); check Orders and Products:
  filter, page 2, Back, Back.
