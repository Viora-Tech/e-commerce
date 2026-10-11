import { loadEnv } from '@commerce/config'
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
/**
 * The server can reach the bucket, but uploads come from the merchant's browser, which also needs
 * the bucket's CORS rule to allow the admin origin. Without it every upload fails while the
 * credential check passes (2026-10-11: R2 bucket with no CORS, "Upload failed" everywhere). So the
 * test asks the bucket the same preflight question the browser asks.
 */
const CORS_CHECK_TIMEOUT_MS = 10_000

function corsRuleFor(origin: string): string {
  return JSON.stringify(
    [
      {
        AllowedOrigins: [origin],
        AllowedMethods: ['GET', 'PUT', 'HEAD'],
        AllowedHeaders: ['*'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3600,
      },
    ],
    null,
    2,
  )
}

async function checkBrowserUploads(
  provider: StorageProvider,
  origin: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const signed = await provider.presignUpload({
    key: `cors-check/${crypto.randomUUID()}.txt`,
    contentType: 'text/plain',
    size: 1,
  })
  // Same-origin or relative upload URLs (the local disk provider) need no CORS.
  if (!/^https?:\/\//.test(signed.url) || new URL(signed.url).origin === origin) return { ok: true }
  const res = await fetch(signed.url, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': signed.method,
      'Access-Control-Request-Headers': Object.keys(signed.headers).join(',') || 'content-type',
    },
    signal: AbortSignal.timeout(CORS_CHECK_TIMEOUT_MS),
  })
  const allowed = res.headers.get('access-control-allow-origin')
  if (res.ok && (allowed === origin || allowed === '*')) return { ok: true }
  return {
    ok: false,
    message: `Connected, but uploads from your browser are blocked. Add this CORS rule to the bucket (bucket settings, CORS policy), then test again:
${corsRuleFor(origin)}`,
  }
}

/** Credentials first, then the browser upload rule; one message for the merchant. */
async function verifyWithUploads(
  provider: StorageProvider,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const creds = await provider.verifyCredentials()
  if (!creds.ok) return creds
  const origin = new URL(loadEnv(process.env).ADMIN_URL).origin
  const uploads = await checkBrowserUploads(provider, origin).catch((err) => {
    console.error('[storage] browser upload check failed', { err })
    return { ok: true as const } // never block on the check itself; the credential test passed
  })
  return uploads.ok ? creds : uploads
}

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
    return await verifyWithUploads(built.provider)
  } catch (err) {
    // Never echo the raw error: it can name internal hosts, ports and addresses (security
    // audit 2026-09-28 branch, ported 2026-10-06). The server log keeps it.
    console.error('[storage] connection test failed', { providerId, err })
    return { ok: false, message: `Could not test the ${factory.label} connection.` }
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
  return verifyWithUploads(provider)
}
