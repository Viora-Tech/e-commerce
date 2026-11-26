-- GST invoices: drop queued tax invoice drafts whose goods an issued tax invoice already bills
-- (owner, 26 Nov 2026: invoiced orders still listed as Ready in the Queue). An order invoiced
-- before it had parcels (one invoice, no parcel) was queued again per parcel when it shipped.
-- Drafts carry no number, so deleting them loses nothing (the Queue's "Remove" does the same).
-- Same rule as `alreadyInvoicedDraft` in packages/plugin-gst-invoices/src/queue-list.ts.
-- Idempotent: a second run finds nothing to delete.
DELETE FROM "invoice" AS d
WHERE d."kind" = 'tax_invoice'
  AND d."status" = 'draft'
  AND EXISTS (
    SELECT 1 FROM "invoice" AS done
    WHERE done."order_id" = d."order_id"
      AND done."kind" = 'tax_invoice'
      AND done."status" = 'issued'
      AND (
        done."fulfillment_order_id" IS NULL
        OR d."fulfillment_order_id" IS NULL
        OR done."fulfillment_order_id" = d."fulfillment_order_id"
      )
  );
