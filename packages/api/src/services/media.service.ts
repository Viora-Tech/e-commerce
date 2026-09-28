import {
  decryptStorageSettings,
  mergeMaskedSecrets,
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

/**
 * A storage Connect page's "Test connection" button: the form's current field values (a
 * masked secret means "use what's already saved") through the provider's own
 * `verifyCredentials()`, before anything is saved. Every `StorageProvider` already
 * implements this uniformly (unlike shipping, there's no provider-specific read-only call to
 * special-case), so one function serves every storage connector — R2 today, S3 and anything
 * added later.
 */
export async function testStorageConnection(
  tx: StoreTx,
  storeId: string,
  registry: StorageRegistry,
  secret: string,
  providerId: string,
  rawFields: Record<string, string>,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const factory = registry.get(providerId)
  if (!factory) return { ok: false, message: 'This storage connection is not available.' }

  const stored = decryptStorageSettings(await loadStorageSettings(tx, storeId), secret).providers[
    providerId
  ]
  const kept = mergeMaskedSecrets(stored ?? {}, rawFields)
  if (!kept.ok)
    return {
      ok: false,
      message:
        'To change where this connects, type the secret again (it is not reused for a new address).',
    }
  const merged = kept.merged

  const built = registry.create(providerId, merged)
  if (!built.ok) return { ok: false, message: built.errors.join(', ') }

  try {
    return await built.provider.verifyCredentials()
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : `Could not test the ${factory.label} connection.`,
    }
  }
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
