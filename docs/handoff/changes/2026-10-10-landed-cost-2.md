# Landed cost step 2: upload bills, AI reads them, review and apply

Branch `feat/landed-cost-2`. **Migration `0095_purchase_documents`** (snapshot
`meta/0095_snapshot.json`, journal idx 90, `when` after `0094_landed_cost`).

## What changed
- **Schema** (`packages/db/src/purchasing-schema.ts`): `purchase_document` on a purchase order or
  an inbound shipment (owner check `>= 1` like `purchase_charge`, exactly one enforced by the
  service): kind, private file key, name, MIME type, size, uploader, status
  (`pending|reading|ready|failed|applied`), `extracted` jsonb, `raw_text`, `error` (a code),
  `applied_at` / `applied_by`. RLS by `apply_store_rls()`; the cross-store leak test seeds it
  and walks the new procedures (passes).
- **AI** (`packages/ai/src/purchase-documents/`): zod schemas for three shapes (supplier
  invoice, Bill of Entry, service bill) with `{ value, confidence }` on every field, prompt,
  PDF text through `unpdf` (MIT, bundles PDF.js, Apache 2.0; credited in
  `THIRD_PARTY_NOTICES.md`), scans and photos sent as a file part. New feature
  `documentReader` (fast tier, temperature 0, 8k output) with its Settings → AI switch and
  `ai.status.documentReader`. The mock model answers fixed fixtures per shape. `textPdf()` in
  `@commerce/ai/testing` builds a real one-page PDF for tests.
- **Core** (`packages/core/src/inventory/`): `document-rules.ts` (kinds, statuses, 15 MB, PDF/JPG/
  PNG, error codes, kind → shape and charge kind, printed amounts → minor units, client-safe),
  `document-match.ts` (SKU exact, then HSN + word-overlap title, else unmatched; never creates
  products), `documents.ts` (upload to `stores/<id>/private/purchase-documents/`, list, file,
  delete, queue a read, reset), `document-apply.ts` (one transaction: draft lines through
  `savePurchaseOrder`, currency and rate, BE details on the shipment, charges through
  `addPurchaseCharge`, mark applied; refused twice). `ai/document-read.ts` is the worker runner
  (admits and meters one call, stores the reading or a failure code).
- **Queue and worker**: `{ai}-purchase-documents` (`QUEUE_LIMITS.purchaseDocuments`, 2, one per
  store), `apps/worker/src/purchase-documents.ts`.
- **API** `purchaseDocuments.list/upload/review/download/delete/read/apply/reset`; inventory
  read/write permissions; `read` is `canDetached` + `heavy('documentRead')` (30 an hour) and
  refuses when AI is off; without a queue it reads in the request (tests).
- **Admin**: "Bills and documents" card on the purchase order and inbound shipment pages
  (kind picker, drag and drop, status chips, polling while reading, read again, download,
  delete) and the review dialog (file preview left; document facts with "Check this" flags,
  exchange rate, BE details, matched lines with the variant picker / order-line picker and
  "Order says 100 @ $12.50, this says 98 @ $12.40", duties per line, charges with ticks; Apply).
  On a sent order the invoice's price differences become one goods adjustment charge with
  per-line manual splits. Copy in `data/purchase-documents.ts` with a Hindi overlay.
- **Docs**: merchant guide "Upload bills and let Vextro read them" (Purchase orders and landed
  cost), developer data model "Purchase documents", AI engine and architecture notes.

## Not done / next
- Deleting a purchase order or shipment removes its document rows (cascade) but not the files;
  they are cleaned when the store is deleted (prefix delete). A sweep could remove them sooner.
- Apply does not keep an undo record; "Allow applying again" undoes nothing.
- Step 3 profit reports and COGS on orders, step 4 PDF/email to supplier.
