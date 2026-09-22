import { loadEnv } from '@commerce/config'
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  parsePreferences,
  readThemePreviewToken,
  signStorefrontAccess,
  verifyStorefrontAccess,
} from '@commerce/core'
import { store, withStore } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { db } from './db'

/** Cookie that keeps a theme preview (opened from the admin's Preview button) across pages. */
export const PREVIEW_COOKIE = 'wc_theme_preview'
export const PREVIEW_MAX_AGE = 60 * 60
export { ACCESS_COOKIE, ACCESS_MAX_AGE }

type Lock = { enabled: boolean; password: string }

const LOCK_TTL_MS = 10_000
const locks = new Map<string, { lock: Lock; expiresAt: number }>()

const secret = () => loadEnv(process.env).SETTINGS_SECRET

/**
 * Whether the store's password page is on, and its password. Cached briefly per
 * process so the proxy does not read preferences on every request; turning the
 * password on or off takes effect within the TTL.
 */
export async function storefrontLock(storeId: string): Promise<Lock> {
  const hit = locks.get(storeId)
  if (hit && hit.expiresAt > Date.now()) return hit.lock
  const prefs = await withStore(db(), storeId, async (tx) => {
    const [row] = await tx
      .select({ preferences: store.preferences })
      .from(store)
      .where(eq(store.id, storeId))
    return parsePreferences(row?.preferences)
  })
  const lock = { enabled: prefs.password.enabled, password: prefs.password.password }
  locks.set(storeId, { lock, expiresAt: Date.now() + LOCK_TTL_MS })
  return lock
}

/** The theme a signed preview token asks for: `{ themeId: null }` means the live theme. */
export function readPreview(storeId: string, token: string | null | undefined) {
  const s = secret()
  if (!token || !s) return null
  return readThemePreviewToken({ secret: s, storeId, token })
}

export function hasAccess(storeId: string, password: string, token: string | undefined): boolean {
  const s = secret()
  return Boolean(s) && verifyStorefrontAccess({ secret: s, storeId, password, token })
}

export function accessToken(storeId: string, password: string): string {
  return signStorefrontAccess({ secret: secret(), storeId, password })
}
