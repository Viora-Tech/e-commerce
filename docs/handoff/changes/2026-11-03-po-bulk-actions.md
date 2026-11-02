# Purchase order bulk actions (#1061)

- The purchase order list's selection bar now offers **Mark as ordered**, **Cancel orders** and
  **Delete** next to Download PDFs and Close (`components/purchase-orders/po-bulk-actions.tsx`).
- Each action runs per order through the existing procedures (`purchaseOrders.markOrdered`,
  `cancel`, `delete`, `close`) with `runBatched`, so the server's own rules decide: orders an
  action doesn't fit are skipped and counted as failed in the "n done, m failed" toast.
- Close, cancel and delete ask first in one shared confirm dialog; cancel and delete use the
  destructive tone. Copy moved from `confirmClose` to `confirm.{close,cancel,delete}` (en + hi).
