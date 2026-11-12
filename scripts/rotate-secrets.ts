#!/usr/bin/env bun
import { loadEnv } from '@commerce/config'
/**
 * Re-encrypts every stored secret under the current SETTINGS_SECRET.
 *
 * Run this after rotating keys: move the old SETTINGS_SECRET into
 * SETTINGS_SECRET_PREVIOUS (comma-separated if more than one), set the new
 * SETTINGS_SECRET, deploy, then run this script. It decrypts every
 * `v1.…`/`v2.…` blob it finds (trying the current key, then each previous
 * key) and re-encrypts it under the current key (`v2.<currentKeyId>.…`).
 * A blob already under the current key is left untouched, so running this
 * twice in a row is a no-op the second time (idempotent).
 *
 * Covers every `encryptSecret` usage in the codebase (`rotateStoreSecrets` in
 * `packages/core/src/secret-rotation.ts`):
 *   - store.payments / .notifications / .shipping / .storage / .login_providers
 *   - store.apps: encrypted values inside apps' own settings (the Umami API key)
 *   - gift_card.code_cipher
 *   - customer.phone (and its blind index customer.phone_index, which is keyed by the secret)
 *   - shopify_import_connection.access_token (added below; the plugin owns that table)
 *
 *   bun run rotate-secrets              # dry run: reports what would change
 *   bun run rotate-secrets --apply      # writes the re-encrypted values
 *
 * Each store is rotated in one transaction, so a store never ends up with some
 * secrets under the old key and some under the new one. Exits 1 when any blob
 * could not be decrypted with any key (fix SETTINGS_SECRET_PREVIOUS and run again).
 * Never run by CI or this codebase's own test suite.
 */
import { type CipherColumn, rotateStoreSecrets, secretKeyId } from '@commerce/core'
import { createDb, store, withStore } from '@commerce/db'
import {
  AFFILIATE_CIPHER_COLUMNS,
  refreshAffiliatePhoneIndexes,
} from '@commerce/plugin-affiliates/server'

/** Plugin-owned encrypted columns core does not know about. */
const PLUGIN_COLUMNS: CipherColumn[] = [
  { label: 'Shopify import tokens', table: 'shopify_import_connection', column: 'access_token' },
  ...AFFILIATE_CIPHER_COLUMNS,
]

async function main() {
  const env = loadEnv(process.env)
  const apply = process.argv.includes('--apply')
  const keyring = {
    current: env.SETTINGS_SECRET,
    previous: env.SETTINGS_SECRET_PREVIOUS,
  }

  console.log(
    `rotate-secrets: ${apply ? 'APPLY' : 'dry run'}, current key id ${secretKeyId(keyring.current)}`,
  )
  if (keyring.previous.length === 0) {
    console.log(
      'rotate-secrets: SETTINGS_SECRET_PREVIOUS is empty, so only legacy v1 blobs under the ' +
        'current key can move. Set it to the retired key(s) before running this.',
    )
  }

  const db = createDb(env.DATABASE_URL_OWNER)
  const totals = { stores: 0, secrets: 0, unreadable: 0 }
  const stores = await db.select({ id: store.id, slug: store.slug }).from(store)

  for (const s of stores) {
    const counts = await withStore(db, s.id, async (tx) => {
      const c = await rotateStoreSecrets(tx, s.id, keyring, { apply, columns: PLUGIN_COLUMNS })
      // Affiliate phone indexes are HMACs under the key: recompute them from the (now moved)
      // customer phones, in the same transaction.
      if (apply) await refreshAffiliatePhoneIndexes(tx, keyring.current, keyring.previous)
      return c
    })
    const columns = Object.entries(counts.columns).filter(([, n]) => n > 0)
    const moved =
      counts.settings +
      counts.appSettings +
      counts.phones +
      columns.reduce((sum, [, n]) => sum + n, 0)
    if (moved + counts.unreadable === 0) continue
    totals.stores += 1
    totals.secrets += moved
    totals.unreadable += counts.unreadable
    const parts = [
      `${counts.settings} settings secret(s)`,
      `${counts.appSettings} app setting secret(s)`,
      `${counts.phones} customer phone(s)`,
      ...columns.map(([label, n]) => `${n} ${label}`),
    ]
    console.log(`rotate-secrets: store ${s.slug} (${s.id}): ${parts.join(', ')}`)
    if (counts.unreadable > 0) {
      console.log(`rotate-secrets: store ${s.slug}: ${counts.unreadable} value(s) no key opens`)
    }
  }

  console.log(
    `rotate-secrets: ${apply ? 'rotated' : 'would rotate'} ${totals.secrets} value(s) across ` +
      `${totals.stores} store(s); ${totals.unreadable} unreadable.`,
  )
  if (!apply && totals.secrets > 0) {
    console.log('rotate-secrets: dry run only, pass --apply to write these changes.')
  }

  await db.$client.end()
  if (totals.unreadable > 0) process.exit(1)
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
