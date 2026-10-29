# File storage is enforced on new uploads

Branch `fix/storage-limit`. The plan's storage (5 / 10 / 50 / 100 GB, set on 28 Oct) was only
shown. Now `media.presign` refuses a new upload when stored files plus the new one pass the
plan's GB (`FORBIDDEN`, `data.reason: 'storage_limit'`); the admin upload helper turns that into
"Your plan's N GB of file storage is full" with what to do.

- Count: `storageRoom` in `packages/core/src/billing/storage-room.ts`, every media row as Plan &
  billing shows it. A trial counts as Growth.
- Only the platform's bucket counts (`onPlatformStorage`: the deployment's R2/S3 defaults or the
  local folder). A bucket the merchant connected has no plan limit.
- Never blocked: files already stored, the storefront, checkout, shopper review photos and
  imports (Shopify and theme imports write media directly, not through presign).
- Test: `packages/api/test/media.test.ts` ("refuses a new upload past the plan's storage").
- Merchant guide: Settings → Plan & billing, "Staff and storage".
