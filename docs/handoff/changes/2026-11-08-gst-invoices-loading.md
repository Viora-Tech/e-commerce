# GST invoices list: skeleton rows while loading

Apps → GST invoices → Invoices no longer says "Nothing issued in this range" before the data
arrives (#1298). The list remembers which tab, month, search, GST number and page its rows answer;
until the response for the current one arrives it draws skeleton rows, and only an empty response
shows the empty message. A failed load toasts "Could not load the invoices" instead of hanging.

- `components/table/table-skeleton-rows.tsx` (new): the skeleton rows the shared list table draws,
  for plain tables. Its accessible label and the load-failed toast use new `tableContent.loading` /
  `loadFailed` copy (English and Hindi).
- Test: `invoices-list.test.tsx`.
