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
 * Covers every `encryptSecret`/`decryptSecret` usage in the codebase:
 *   - store.payments / .notifications / .shipping / .storage (provider config)
 *   - store.login_providers (merchants' own shopper sign-in apps)
 *   - gift_card.code_cipher
 *   - shopify_import_connection.access_token
 *
 *   bun scripts/rotate-secrets.ts              # dry run: reports what would change
 *   bun scripts/rotate-secrets.ts --apply       # writes the re-encrypted values
 *
 * Each store's rows are updated in one transaction, so a store never ends up
 * with some secrets under the old key and some under the new one. Never run
 * by CI or this codebase's own test suite.
 */
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  type ProviderSettings,
  parsePreviousSecrets,
  secretKeyId,
} from '@commerce/core'
import { createDb, giftCard, store } from '@commerce/db'
import { shopifyConnection } from '@commerce/plugin-shopify-import/schema'
import { eq } from 'drizzle-orm'

type Counts = { stores: number; secrets: number; giftCards: number; shopifyConnections: number }

/** Re-encrypts one provider-settings JSON blob's secret-looking values under the current key. */
function rotateProviderSettings(
  raw: unknown,
  keyring: { current: string; previous: string[]; currentKeyId: string },
): { changed: boolean; next: unknown; count: number } {
  if (!raw || typeof raw !== 'object' || !('providers' in raw)) {
    return { changed: false, next: raw, count: 0 }
  }
  const settings = raw as ProviderSettings
  let count = 0
  const providers: ProviderSettings['providers'] = {}
  for (const [id, cfg] of Object.entries(settings.providers ?? {})) {
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(cfg)) {
      if (isEncryptedSecret(v) && !v.startsWith(`v2.${keyring.currentKeyId}.`)) {
        const plain = decryptSecret(v, keyring.current, keyring.previous)
        next[k] = encryptSecret(plain, keyring.current)
        count++
      } else {
        next[k] = v
      }
    }
    providers[id] = next
  }
  return { changed: count > 0, next: { ...settings, providers }, count }
}

async function main() {
  const env = loadEnv(process.env)
  const apply = process.argv.includes('--apply')
  const previous = parsePreviousSecrets(env.SETTINGS_SECRET_PREVIOUS)
  const keyring = {
    current: env.SETTINGS_SECRET,
    previous,
    currentKeyId: secretKeyId(env.SETTINGS_SECRET),
  }

  console.log(
    `rotate-secrets: ${apply ? 'APPLY' : 'dry run'} — current key id ${keyring.currentKeyId}`,
  )
  if (previous.length === 0) {
    console.log(
      'rotate-secrets: SETTINGS_SECRET_PREVIOUS is empty — only blobs already decryptable under ' +
        'the current SETTINGS_SECRET will rotate; anything under an old key will fail to decrypt. ' +
        'Set SETTINGS_SECRET_PREVIOUS to the retired key(s) before running this.',
    )
  }

  const db = createDb(env.DATABASE_URL_OWNER)
  const counts: Counts = { stores: 0, secrets: 0, giftCards: 0, shopifyConnections: 0 }

  const stores = await db.select({ id: store.id, slug: store.slug }).from(store)

  for (const s of stores) {
    await db.transaction(async (tx) => {
      let storeSecrets = 0
      const [row] = await tx
        .select({
          payments: store.payments,
          notifications: store.notifications,
          shipping: store.shipping,
          storage: store.storage,
          loginProviders: store.loginProviders,
        })
        .from(store)
        .where(eq(store.id, s.id))
      if (row) {
        const updates: Record<string, unknown> = {}
        for (const col of [
          'payments',
          'notifications',
          'shipping',
          'storage',
          'loginProviders',
        ] as const) {
          const result = rotateProviderSettings(row[col], keyring)
          if (result.changed) {
            updates[col] = result.next
            storeSecrets += result.count
          }
        }
        if (Object.keys(updates).length > 0) {
          console.log(
            `rotate-secrets: store ${s.slug} (${s.id}): ${storeSecrets} secret(s) in ${Object.keys(updates).join(', ')}`,
          )
          if (apply) await tx.update(store).set(updates).where(eq(store.id, s.id))
        }
      }

      const cards = await tx
        .select({ id: giftCard.id, codeCipher: giftCard.codeCipher })
        .from(giftCard)
        .where(eq(giftCard.storeId, s.id))
      let storeGiftCards = 0
      for (const card of cards) {
        if (!card.codeCipher) continue
        if (!isEncryptedSecret(card.codeCipher)) continue
        if (card.codeCipher.startsWith(`v2.${keyring.currentKeyId}.`)) continue
        const plain = decryptSecret(card.codeCipher, keyring.current, keyring.previous)
        const next = encryptSecret(plain, keyring.current)
        storeGiftCards++
        if (apply)
          await tx.update(giftCard).set({ codeCipher: next }).where(eq(giftCard.id, card.id))
      }
      if (storeGiftCards > 0) {
        console.log(`rotate-secrets: store ${s.slug}: ${storeGiftCards} gift card code(s)`)
      }

      const conns = await tx
        .select({ id: shopifyConnection.id, accessToken: shopifyConnection.accessToken })
        .from(shopifyConnection)
        .where(eq(shopifyConnection.storeId, s.id))
      let storeConns = 0
      for (const conn of conns) {
        if (!isEncryptedSecret(conn.accessToken)) continue
        if (conn.accessToken.startsWith(`v2.${keyring.currentKeyId}.`)) continue
        const plain = decryptSecret(conn.accessToken, keyring.current, keyring.previous)
        const next = encryptSecret(plain, keyring.current)
        storeConns++
        if (apply) {
          await tx
            .update(shopifyConnection)
            .set({ accessToken: next })
            .where(eq(shopifyConnection.id, conn.id))
        }
      }
      if (storeConns > 0) {
        console.log(`rotate-secrets: store ${s.slug}: ${storeConns} Shopify import connection(s)`)
      }

      if (storeSecrets + storeGiftCards + storeConns > 0) counts.stores++
      counts.secrets += storeSecrets
      counts.giftCards += storeGiftCards
      counts.shopifyConnections += storeConns
    })
  }

  console.log(
    `rotate-secrets: ${apply ? 'rotated' : 'would rotate'} ${counts.secrets} provider secret(s), ` +
      `${counts.giftCards} gift card code(s), ${counts.shopifyConnections} Shopify connection(s) ` +
      `across ${counts.stores} store(s).`,
  )
  if (!apply && counts.stores > 0) {
    console.log('rotate-secrets: dry run only — pass --apply to write these changes.')
  }

  await db.$client.end()
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
