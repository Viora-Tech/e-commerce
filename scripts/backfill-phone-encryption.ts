#!/usr/bin/env bun
import { loadEnv } from '@commerce/config'
/**
 * Encrypts every plaintext `customer.phone` still on disk and fills in its
 * `customer.phone_index` blind index, so search and dedupe keep working once
 * the column holds ciphertext. Run this once after deploying the migration
 * that adds `phone_index` (`packages/db/drizzle/0064_customer_phone_index.sql`)
 * and before merchants start relying on phone search again.
 *
 * Idempotent: a row already holding an encrypted (`v1.…`/`v2.…`) value, or with
 * no phone at all, is left untouched, so running this twice in a row is a
 * no-op the second time. Each store's rows are updated in one transaction.
 *
 *   bun scripts/backfill-phone-encryption.ts              # dry run: reports what would change
 *   bun scripts/backfill-phone-encryption.ts --apply       # writes the encrypted values
 */
import { encryptCustomerPhone, isEncryptedSecret } from '@commerce/core'
import { createDb, customer } from '@commerce/db'
import { eq } from 'drizzle-orm'

async function main() {
  const env = loadEnv(process.env)
  const apply = process.argv.includes('--apply')
  const db = createDb(env.DATABASE_URL_OWNER)

  const rows = await db
    .select({ id: customer.id, storeId: customer.storeId, phone: customer.phone })
    .from(customer)

  const toBackfill = rows.filter((r) => r.phone && !isEncryptedSecret(r.phone))
  console.log(
    `backfill-phone-encryption: ${apply ? 'APPLY' : 'dry run'} — ` +
      `${toBackfill.length} of ${rows.length} customer row(s) have a plaintext phone.`,
  )

  const byStore = new Map<string, typeof toBackfill>()
  for (const r of toBackfill) {
    const list = byStore.get(r.storeId) ?? []
    list.push(r)
    byStore.set(r.storeId, list)
  }

  let total = 0
  for (const [storeId, list] of byStore) {
    console.log(`backfill-phone-encryption: store ${storeId}: ${list.length} row(s)`)
    if (!apply) {
      total += list.length
      continue
    }
    await db.transaction(async (tx) => {
      for (const r of list) {
        if (!r.phone) continue
        const { cipher, index } = encryptCustomerPhone(r.phone, env.SETTINGS_SECRET)
        await tx
          .update(customer)
          .set({ phone: cipher, phoneIndex: index })
          .where(eq(customer.id, r.id))
        total += 1
      }
    })
  }

  console.log(
    `backfill-phone-encryption: ${apply ? 'encrypted' : 'would encrypt'} ${total} customer phone(s).`,
  )
  if (!apply && total > 0) {
    console.log('backfill-phone-encryption: dry run only — pass --apply to write these changes.')
  }

  await db.$client.end()
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
