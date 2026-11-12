# A variant's own box (#1517) and "Sent for approval" as a notice (#1531)

Branch `fix/variant-box-approval-notice`, PR into `dev`. Migration `0238_variant_box_own.sql`.

## Own box per variant (#1517, owner: "Optional override")

- The product keeps one Package (Shipping tab). Each variant's Edit dialog (Variants tab) has an
  optional **Box** select: "Same as product (<box>)", then the named boxes. Only shown for
  variants that require shipping. Sizes stay only in the named boxes (Settings › Shipping).
- Storage: the box in use is still written on every variant (`variant.box_preset_id` and the
  package dims), so nothing that resolves a parcel changed. New column `variant.box_own`
  (nullable boolean): true = the variant picked its own box; null/false = it follows the
  product's Package. The product's Package is `productBoxOf(variants)`: the box of the first
  variant that follows the product (`packages/core/src/catalog/variant-box.ts`).
- Product page: changing Package writes only onto variants without their own box
  (`patchPackage` in `product-form.tsx`). "Same as product" in the dialog copies the product's box
  back and clears the flag. New rows from an option change take the product's Package, not the
  first row's own box (`emptyVariant(…, productBox)`).
- Shown, not hidden: an "Own box" chip in the variants table; the Shipping tab names the variants
  with their own box under the Package picker (and disables it when every variant has its own).
- Products list "Set weight and box" (`bulk-shipping.ts`): without an option value it is the
  product's Package and skips own-box variants; with an option value ("XL") the box becomes those
  variants' own. Setting a named box there now also clears a custom size (as the product page does).
- Bulk editor sheet (`bulk-edit.ts`, `settleEditedBoxes`): a row whose box cell changed becomes
  "own" when it differs from the product's Package and follows the product again when it
  matches (`settleBoxOwn`).
- Migration backfill: per product, the most common box among live variants is the product's;
  variants with any other box are marked `box_own = true`.
- Resolution points (all read the variant's stored box, so the override wins, then the product's
  box, then the store default): create-shipment draft (`create-shipment.service.ts`), booking and
  bulk shipments (`core/shipping/shipments.ts`), packing cost (`profit-parcels.ts`), volumetric
  line on the Shipping tab, `resolveParcelPackage` / `parcelBoxPreset` (mixed parcels still use
  the biggest box). Checkout courier rates (delivery options) use cart weight only and never read
  a box, before or after this change.

## "Sent for approval" is a notice, not "Save failed" (#1531)

- `components/approvals/save-error-alert.tsx`: forms render their stored save error through it.
  When the message is the approvals sentence (`isApprovalNotice` in `lib/approval-notice.ts`,
  which remembers what `showApprovalNotice` showed), it draws an amber notice titled "Sent for
  approval" with a link to Settings › Approvals instead of the red alert.
- Swapped in: product form, discounts, catalogs, pre-order campaigns, shipping profiles and
  zones, rollouts, provider settings, S3 and shared app connect pages, growth campaign and
  automation editors. Toasts were already handled by `lib/approval-notice.ts`.

## Not verified

- No browser check (no dev server on this machine for this work): the Box select, chip, Shipping
  tab note and the amber notice are owed a look on the test server.
- `packages/api/test/products-bulk-shipping.test.ts` gained an own-box case but was not run: a
  fresh test database failed to migrate here ("out of shared memory", max_locks_per_transaction).
  The migration itself was run in a rolled-back transaction on the api test template.
- Another branch (`feat/preorder-variant-limit`) adds a field to the same variant Edit dialog; the
  box field is its own component (`variant-box-field.tsx`), wired in with one line.
