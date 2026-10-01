# Multi-tenant hardening: fairness, key rotation, leak test, store export and delete

**Branch** `fix/multi-tenant-hardening`, based on `fix/security-audit-2026-09` (PR #218);
merge after #218. **Migration `0078_store_data`**: tables `store_export` (per store, RLS) and
`platform_audit_event` (platform level, app role may only INSERT), and the privacy audit
trail's append-only trigger now lets a row go only inside the transaction that deletes its
store (`app.store_delete`). What a new session needs to know:

- **Noisy neighbours.** Every store-job queue has `concurrency` and a lower `perStore` cap in
  `QUEUE_LIMITS` (`packages/queue/src/index.ts`); `fairProcessor` (`packages/queue/src/fair.ts`)
  takes a Redis lease slot per store and defers over-cap jobs with `moveToDelayed` +
  `DelayedError`. Wired into notifications, app events, app jobs, marketing send, media,
  back in stock and store export. Heavy admin actions use `.use(heavy('import' | 'bulk' |
  'export' | 'storeData'))` (`packages/api/src/procedures/heavy.ts`): one budget per store per
  kind. Design and numbers: developer docs, Architecture, section 3.
- **Key rotation.** Ciphertexts already carried key ids (`v2.<keyId>.…`). New:
  `decryptSecret` also reads `SETTINGS_SECRET_PREVIOUS` from the environment (gift cards and
  Shopify tokens never passed the keyring before); saving a settings blob re-encrypts old-key
  secrets in it (lazy rotation); `bun run rotate-secrets` now covers customer phones and their
  blind index too (`rotateStoreSecrets`, `packages/core/src/secret-rotation.ts`) and exits 1 on
  values no key opens. Runbook: developer docs, Operations, Key rotation.
- **Cross-store leak test** (`packages/api/test/cross-store-leak.test.ts`, in `docs/guardrails.md`):
  seeds two stores with a row in every `store_id` table (`@commerce/db/test/seed`, generic),
  walks the whole oRPC router and the storefront loaders as store A with A's ids and with B's,
  and fails on any B data in a response, any change to B, or any B id written into A. It found
  two foreign-id bugs, fixed here: `orders.addNote` accepted another store's order id, and
  marketing campaigns accepted another store's segment id. Procedures that call an outside
  service are in its `SKIP` list with reasons.
- **Store export and delete.** Settings → General, bottom: "Download your data" (worker job
  `{store}-export`, zip of NDJSON per table into `stores/<id>/private/exports/`, 7 days,
  secrets redacted, phones decrypted) and the owner-only "Delete store" danger zone (type the
  store name; files via the new optional `StorageProvider.deletePrefix`, then every row in FK
  order, then the store and its Better Auth organization). API: `storeData.*`. Core:
  `packages/core/src/store-data/`. Merchant docs: Settings, "Download your data or delete
  your store".

**Left for the owner**: whether admins (settings.manage) should keep the full export or it
should be owner-only like delete; whether `platform_audit_event` needs a platform page; the
fairness caps are not work-conserving (a store alone still gets only `perStore` slots), so
watch media processing speed during a big import and raise `perStore` there if needed.
