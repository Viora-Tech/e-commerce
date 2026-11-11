/** SOURCE OF TRUTH: SETTINGS_SECRET key rotation — re-encrypts one store's stored secrets under the current key */
import { customer, type StoreTx, store } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import { lockStoreApps } from './apps/locked'
import { phoneBlindIndex } from './customers/phone-crypto'
import {
  decryptSecret,
  encryptSecret,
  isEncrypted,
  isUnderCurrentKey,
  type Keyring,
} from './secrets'
import type { ProviderSettings } from './settings/secrets'

/**
 * One text column that holds a single `encryptSecret` blob per row. Plugins own some of
 * these (the Shopify importer's access token), so the caller can add its own on top of
 * `CORE_CIPHER_COLUMNS`; names are SQL names, not Drizzle keys.
 */
export type CipherColumn = { label: string; table: string; column: string }

/** Every single-blob column core itself writes with `encryptSecret`. */
const CORE_CIPHER_COLUMNS: CipherColumn[] = [
  { label: 'gift card codes', table: 'gift_card', column: 'code_cipher' },
]

/** The `store` columns holding a `ProviderSettings` blob with encrypted fields. */
const SETTINGS_COLUMNS = [
  'payments',
  'notifications',
  'shipping',
  'storage',
  'loginProviders',
] as const

export type RotationCounts = {
  /** Secret fields inside the store's settings blobs. */
  settings: number
  /** Encrypted values inside apps' own settings (`store.apps.settings.<app>`, the Umami key). */
  appSettings: number
  /** Per `CipherColumn.label`. */
  columns: Record<string, number>
  /** `customer.phone`, re-encrypted with its blind index recomputed. */
  phones: number
  /** Blobs no key in the ring opens; left as they are and reported. */
  unreadable: number
}

const isProviderSettings = (v: unknown): v is ProviderSettings =>
  !!v && typeof v === 'object' && 'providers' in v

/** Plaintext, or null when no key in the ring opens it. */
function tryDecrypt(blob: string, keyring: Keyring): string | null {
  try {
    return decryptSecret(blob, keyring.current, keyring.previous)
  } catch {
    return null
  }
}

/**
 * The settings blob with every secret not under the current key re-encrypted. Plaintext
 * fields are left exactly as they are; only ciphertext moves.
 */
function rotateSettings(
  s: ProviderSettings,
  keyring: Keyring,
): { next: ProviderSettings; moved: number; unreadable: number } {
  let moved = 0
  let unreadable = 0
  const providers: ProviderSettings['providers'] = {}
  for (const [id, cfg] of Object.entries(s.providers ?? {})) {
    providers[id] = Object.fromEntries(
      Object.entries(cfg).map(([k, v]) => {
        if (!isEncrypted(v) || isUnderCurrentKey(v, keyring.current)) return [k, v]
        const plain = tryDecrypt(v, keyring)
        if (plain === null) {
          unreadable += 1
          return [k, v]
        }
        moved += 1
        return [k, encryptSecret(plain, keyring.current)]
      }),
    )
  }
  return { next: { ...s, providers }, moved, unreadable }
}

/**
 * `store.apps` with every encrypted value inside the apps' own settings
 * (`settings.<appId>`, at any depth) moved onto the current key. Apps keep a secret there
 * as a plain `encryptSecret` string (the Umami API key); anything else, and the install list,
 * is left exactly as it is.
 */
export function rotateAppSettings(
  apps: unknown,
  keyring: Keyring,
): { next: unknown; moved: number; unreadable: number } {
  let moved = 0
  let unreadable = 0
  const walk = (value: unknown): unknown => {
    if (isEncrypted(value)) {
      if (isUnderCurrentKey(value, keyring.current)) return value
      const plain = tryDecrypt(value, keyring)
      if (plain === null) {
        unreadable += 1
        return value
      }
      moved += 1
      return encryptSecret(plain, keyring.current)
    }
    if (Array.isArray(value)) return value.map(walk)
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]))
    }
    return value
  }
  if (!apps || typeof apps !== 'object' || !('settings' in apps)) {
    return { next: apps, moved, unreadable }
  }
  const settings = walk((apps as { settings: unknown }).settings)
  return { next: moved > 0 ? { ...apps, settings } : apps, moved, unreadable }
}

/**
 * Moves every secret one store holds onto `keyring.current`: the provider settings
 * blobs on `store`, the apps' own settings (`store.apps`), each `CipherColumn`, and `customer.phone` (whose blind index is
 * keyed by the secret too, so it is recomputed). Values already under the current key
 * are untouched, so a second run reports zero. With `apply: false` nothing is written
 * and the counts say what would change.
 *
 * Run it inside one transaction per store (`withStore` on the owner connection, or the
 * app connection, where RLS keeps it to this store) so a store never ends up half
 * rotated.
 */
export async function rotateStoreSecrets(
  tx: StoreTx,
  storeId: string,
  keyring: Keyring,
  opts: { apply: boolean; columns?: CipherColumn[] | undefined },
): Promise<RotationCounts> {
  const counts: RotationCounts = {
    settings: 0,
    appSettings: 0,
    columns: {},
    phones: 0,
    unreadable: 0,
  }

  // Rewriting store.apps: hold the row lock first, so an app saved meanwhile is not lost.
  if (opts.apply) await lockStoreApps(tx, storeId)
  const [row] = await tx
    .select({
      payments: store.payments,
      notifications: store.notifications,
      shipping: store.shipping,
      storage: store.storage,
      loginProviders: store.loginProviders,
      apps: store.apps,
    })
    .from(store)
    .where(eq(store.id, storeId))
  if (row) {
    const updates: Partial<Record<(typeof SETTINGS_COLUMNS)[number] | 'apps', unknown>> = {}
    for (const col of SETTINGS_COLUMNS) {
      const value = row[col]
      if (!isProviderSettings(value)) continue
      const r = rotateSettings(value, keyring)
      counts.unreadable += r.unreadable
      counts.settings += r.moved
      if (r.moved > 0) updates[col] = r.next
    }
    const apps = rotateAppSettings(row.apps, keyring)
    counts.unreadable += apps.unreadable
    counts.appSettings += apps.moved
    if (apps.moved > 0) updates.apps = apps.next
    if (opts.apply && Object.keys(updates).length > 0) {
      await tx.update(store).set(updates).where(eq(store.id, storeId))
    }
  }

  for (const target of [...CORE_CIPHER_COLUMNS, ...(opts.columns ?? [])]) {
    const table = sql.identifier(target.table)
    const column = sql.identifier(target.column)
    const rows = await tx.execute<{ id: string; blob: string }>(
      sql`select id, ${column} as blob from ${table} where store_id = ${storeId} and ${column} is not null`,
    )
    let moved = 0
    for (const r of rows) {
      if (!isEncrypted(r.blob) || isUnderCurrentKey(r.blob, keyring.current)) continue
      const plain = tryDecrypt(r.blob, keyring)
      if (plain === null) {
        counts.unreadable += 1
        continue
      }
      moved += 1
      if (opts.apply) {
        await tx.execute(
          sql`update ${table} set ${column} = ${encryptSecret(plain, keyring.current)} where id = ${r.id}`,
        )
      }
    }
    counts.columns[target.label] = (counts.columns[target.label] ?? 0) + moved
  }

  const phones = await tx
    .select({ id: customer.id, phone: customer.phone })
    .from(customer)
    .where(eq(customer.storeId, storeId))
  for (const c of phones) {
    if (!c.phone || !isEncrypted(c.phone) || isUnderCurrentKey(c.phone, keyring.current)) continue
    const plain = tryDecrypt(c.phone, keyring)
    if (plain === null) {
      counts.unreadable += 1
      continue
    }
    counts.phones += 1
    if (opts.apply) {
      await tx
        .update(customer)
        .set({
          phone: encryptSecret(plain, keyring.current),
          phoneIndex: phoneBlindIndex(plain, keyring.current),
        })
        .where(eq(customer.id, c.id))
    }
  }

  return counts
}
