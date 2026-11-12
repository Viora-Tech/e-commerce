# GST invoices: Print, and same-day numbering by order number (#1606)

- Invoice page: a **Print** button beside Download PDF opens the PDF in a new tab for the browser to
  print (as the list's bulk Print does).
- `issueDrafts` (`plugin-gst-invoices/src/queue.ts`) sorts a batch by invoice **day**, then order
  number, then time: one day's invoices are numbered #2401, #2402… whatever order they were packed in.
  The date rule is day-level, so numbers still never go back in date. The "To review" list
  (`listQueue`) shows the same order. Test in `test/issue.test.ts`.
