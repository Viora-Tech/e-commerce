import {
  parseStorageSettings,
  resolveStorageProvider,
  type StorageSettings,
  storageDefaultsFromEnv,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import type { StorageProvider, StorageRegistry } from '@commerce/storage'
import { eq } from 'drizzle-orm'

export async function updateStoreStorage(tx: StoreTx, storeId: string, storage: unknown) {
  const [s] = await tx.update(store).set({ storage }).where(eq(store.id, storeId)).returning()
  return s ?? null
}

/**
 * Stored settings, or the env-seeded R2 defaults when the merchant has not
 * saved anything yet. Seeding from env means a deployment with R2_* set
 * uploads to the bucket from the first product without visiting Settings.
 */
export async function loadStorageSettings(tx: StoreTx, storeId: string): Promise<StorageSettings> {
  const [s] = await tx.select({ storage: store.storage }).from(store).where(eq(store.id, storeId))
  if (s?.storage) return parseStorageSettings(s.storage)
  return storageDefaultsFromEnv(process.env)
}

/** The provider this store uploads to right now (never null: the local folder is the floor). */
export async function storageProviderFor(
  tx: StoreTx,
  storeId: string,
  registry: StorageRegistry,
  secret: string,
): Promise<StorageProvider> {
  return resolveStorageProvider(registry, await loadStorageSettings(tx, storeId), secret).provider
}

export async function verifyStorageCredentials(
  tx: StoreTx,
  storeId: string,
  registry: StorageRegistry,
  secret: string,
) {
  const { provider, errors } = resolveStorageProvider(
    registry,
    await loadStorageSettings(tx, storeId),
    secret,
  )
  if (errors.length) return { ok: false, message: errors.join('; ') }
  return provider.verifyCredentials()
}
