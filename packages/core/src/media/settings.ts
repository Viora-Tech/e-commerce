import { type StoreTx, store } from '@commerce/db'
import { type StorageProvider, StorageRegistry } from '@commerce/storage'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { LOCAL_UPLOAD_DIR, localStorageFactory } from '../providers/local-storage'
import {
  decryptProviderSettings,
  encryptProviderSettings,
  maskProviderSettings,
} from '../settings/secrets'

/** Progress of "Move existing files to <connection>", polled by the admin while it runs. */
export const StorageMigrationSchema = z.object({
  targetProviderId: z.string().min(1),
  status: z.enum(['running', 'done', 'failed']),
  total: z.number().int().min(0),
  done: z.number().int().min(0),
  failed: z.number().int().min(0),
  startedAt: z.string(),
  updatedAt: z.string(),
  error: z.string().optional(),
})
export type StorageMigration = z.infer<typeof StorageMigrationSchema>

/** Stored on store.storage. Secret fields are encrypted before they reach the row. */
export const StorageSettingsSchema = z.object({
  /** At most one provider matters; the first enabled and valid one receives uploads. */
  enabled: z.array(z.string().min(1)).default([]),
  providers: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  /** Set while "Move existing files to <connection>" runs; cleared is null. */
  migration: StorageMigrationSchema.nullable().default(null),
})
export type StorageSettings = z.infer<typeof StorageSettingsSchema>

export const defaultStorageSettings: StorageSettings = StorageSettingsSchema.parse({})

export function parseStorageSettings(raw: unknown): StorageSettings {
  const r = StorageSettingsSchema.safeParse(raw)
  return r.success ? r.data : defaultStorageSettings
}

const fieldsOf = (registry: StorageRegistry) => (id: string) => registry.get(id)?.fields

export const encryptStorageSettings = (
  s: StorageSettings,
  secret: string,
  registry?: StorageRegistry,
): StorageSettings => encryptProviderSettings(s, secret, registry ? fieldsOf(registry) : undefined)

export const decryptStorageSettings = (
  s: StorageSettings,
  secret: string,
  previousSecrets: string[] = [],
): StorageSettings => decryptProviderSettings(s, secret, previousSecrets)

export const maskStorageSettings = (
  s: StorageSettings,
  registry?: StorageRegistry,
): StorageSettings => maskProviderSettings(s, registry ? fieldsOf(registry) : undefined)

/** Storage every deployment has without an adapter package: the local folder. */
export function builtInStorageRegistry(): StorageRegistry {
  return new StorageRegistry().register(localStorageFactory)
}

/**
 * The provider uploads go to: the first enabled and valid one, else the
 * local folder so a fresh store can upload before any bucket exists.
 */
export function resolveStorageProvider(
  registry: StorageRegistry,
  settings: StorageSettings,
  secret: string,
  previousSecrets: string[] = [],
): { provider: StorageProvider; errors: string[] } {
  const decrypted = decryptStorageSettings(settings, secret, previousSecrets)
  const errors: string[] = []
  for (const id of decrypted.enabled) {
    const r = registry.create(id, decrypted.providers[id] ?? {})
    if (r.ok) return { provider: r.provider, errors }
    errors.push(`${id}: ${r.errors.join(', ')}`)
  }
  const local = registry.create('local', {})
  if (local.ok) return { provider: local.provider, errors }
  const v = localStorageFactory.validateConfig({})
  const config = v.ok ? v.config : { baseUrl: 'http://localhost:3200', dir: LOCAL_UPLOAD_DIR }
  return { provider: localStorageFactory.create(config), errors }
}

/** Env-seeded defaults so a deployment with R2_* in .env needs no form filling. */
export function storageDefaultsFromEnv(env: Record<string, string | undefined>): StorageSettings {
  const r2 = {
    accountId: env.R2_ACCOUNT_ID ?? '',
    accessKeyId: env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? '',
    bucket: env.R2_BUCKET ?? '',
    publicBaseUrl: env.R2_PUBLIC_BASE_URL ?? '',
  }
  const complete = Object.values(r2).every((v) => v.length > 0)
  return complete ? { enabled: ['r2'], providers: { r2 }, migration: null } : defaultStorageSettings
}

export { StorageRegistry }

/** Merges a migration progress patch into the store's saved storage settings. */
export async function updateStorageMigration(
  tx: StoreTx,
  storeId: string,
  migration: StorageMigration | null,
): Promise<void> {
  const current = await loadStoreStorageSettings(tx, storeId)
  await tx
    .update(store)
    .set({ storage: { ...current, migration } })
    .where(eq(store.id, storeId))
}

/**
 * Stored storage settings for a store, or the env-seeded defaults when the
 * merchant has not saved any. Server only.
 */
export async function loadStoreStorageSettings(
  tx: StoreTx,
  storeId: string,
): Promise<StorageSettings> {
  const [s] = await tx.select({ storage: store.storage }).from(store).where(eq(store.id, storeId))
  if (s?.storage) return parseStorageSettings(s.storage)
  return storageDefaultsFromEnv(process.env)
}

/** The provider a store writes to right now; the local folder is the floor. */
export async function storageForStore(
  tx: StoreTx,
  storeId: string,
  registry: StorageRegistry,
  secret: string,
): Promise<StorageProvider> {
  return resolveStorageProvider(registry, await loadStoreStorageSettings(tx, storeId), secret)
    .provider
}
