# GST registrations per business, phase 1

**Branch** `feat/gst-registrations`, based on `fix/security-owner-decisions`; merge after #218,
#219 and #220. **Migration `0080_gst_registrations`**: tables `business` and `gst_registration`
(per store, RLS via `apply_store_rls()`), column `location.gst_registration_id`, and a backfill.
Phase 1 of the multi-warehouse GST design: recorded and linked only, no change to tax or invoices.

- **Model.** `business` = one PAN (exactly one `is_primary` per store, unique `(store_id, pan)`;
  payout columns for a later Razorpay Route phase, unread). `gst_registration` = one GSTIN
  (unique `(store_id, gstin)`; `state_code` is a generated column `left(gstin, 2)`; one
  `is_default` per store; `cancelled_at` instead of delete). Rules live in
  `packages/core/src/tax/registrations.ts` (SOURCE OF TRUTH header): PAN must equal GSTIN
  chars 3–12, a location only bills under its own state's GSTIN, cancelling hands the default on.
  Boundary schemas and refusal codes: `packages/core/src/tax/registration-schemas.ts`
  (`@commerce/core/gst-registrations`, client-safe).
- **`store.gstin` is now a mirror** of the default registration, written only by
  `mirrorStoreGstin`. Taxes & GST and General saves call `adoptStoreGstin`: no registration yet →
  the GSTIN becomes the first one; otherwise a different GSTIN is refused (`MANAGED_ELSEWHERE`)
  and the Taxes page shows the GSTIN read-only (`TaxesView.gstinManaged`). The GST invoices
  app's own `seller.gstin` copy is NOT synced here (phase 2/3 question).
- **Backfill**: stores whose `store.gstin` is well formed (shape regex, not checksum) get one
  primary business (legal name from the invoices app's seller block, else store name) and one
  default registration (address from the seller block, else `store.address`). Stores without a
  GSTIN get nothing; a business needs a PAN. Idempotent; tested in
  `packages/db/test/gst-registration-backfill.test.ts`.
- **API**: `businessGst` router (`get` = settings.read; everything else settings.manage).
  Refusals are `BAD_REQUEST` with `data.code` (admin offers "Add it as another business" on
  `PAN_MISMATCH`). Covered by the cross-store leak walk automatically.
- **Admin**: Settings → Business and GST (`/settings/business`) and Settings → Locations
  (`/settings/locations`, `/settings/locations/[id]` with "Bills under"). Copy in
  `data/business-gst.ts`, Hindi in `data/hi/business-gst.ts`.
- **Docs**: merchant guide Settings → Business and GST and Locations; developer docs Data model,
  "Businesses and GST" tab.
- **Next phases** (not here): invoices per GSTIN and numbering per registration, dispatch-state
  GST in `computeOrderGst`, fulfilment orders per location, Razorpay Route payouts.
