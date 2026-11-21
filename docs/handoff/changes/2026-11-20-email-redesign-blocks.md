# Transactional emails built from shared blocks (Figma "Emails" batches 1-10)

Branch `feat/email-redesign-base`. No migration.

## What changed

- Every transactional email now renders from shared blocks in
  `packages/notifications/src/emails/blocks/`: ticket, notice, status, facts, stats, columns,
  quote, code, coupon, attachment, product, products, parcels, items, button, divider, text and
  links. `BlockList` draws them with the same spacing in every email.
- Each template has a composer in `packages/notifications/src/templates/compose/` (one file per
  Figma batch: codes, delivery, updates, payments, returns, account, marketing, team), all
  registered in `COMPOSERS` in `compose/index.ts`. A composer picks the kicker and the blocks, and
  may replace the heading and intro in the HTML only (the plain-text part keeps the copy).
- Copy: headings and intros stay in `templates/content*.ts`. The words around the blocks are in
  `templates/content-blocks.ts` and `content-blocks-2.ts`. The footer's "You get this email
  because…" line is in `templates/content-footer.ts`.
- New template `welcome_coupon` (batch 8): the code, what it takes off and popular products. It
  renders and previews, and Settings → Notifications lists it under the Automations app. The
  Automations welcome flow still sends its own email, so nothing sends `welcome_coupon` yet.
- New `TemplateData` fields, filled in at send time:
  - `deliveredLabel` and `paymentRef`, from `core/notifications/event-data.ts`
  - `previousWaybill` on shipping_update
  - `document` (number, GSTIN, file name), passed by the GST invoices app through `ctx.notify`
  - `review.rating` and `review.text` on review_reply (Reviews app, then the worker)
- The return emails put a status word under each item ("Refunded", "Wrong size"). They use the
  line note to do it.
- `TemplateId` moved to `template-ids.ts`. The samples are split into `samples.ts`,
  `samples-order.ts` (the Figma order #1042) and `samples-dated.ts`.

## Left to do

- The Copy code button needs a storefront page that copies the code.
- Not in the data yet:
  - "received by" on delivered
  - one-tap Approve on affiliate applications (it would need an approve endpoint)
  - distance in km
  - the PDF's size and page count
  - star taps on review requests
  - the return quality-check result
- The legacy `TransactionalEmail` fields no longer serve any template and can be removed.
- The owner still has to approve the Figma batches; each one is marked "Waiting for your OK".
