/**
 * SOURCE OF TRUTH KEYWORDS: StorageScopeProvider, useStorageScope, scopedStorageKey, LEGACY_UNSCOPED_KEYS
 * WHAT:  who and which store browser storage (localStorage / sessionStorage) belongs to, and the
 *        key builder every store-specific stored value goes through.
 * WHY:   staff share computers and switch stores in one tab; an unscoped key (recent media,
 *        recent links, a provider's "tested" badge) carried one store's data into another.
 * WHERE: provided by `StorageScopeProvider` in the (admin) and (editor) layouts; read by the helpers that keep recents,
 *        badges, the block clipboard and similar conveniences. Purely global UI preferences
 *        (theme, sidebar, panel layout, table columns, globe look) stay unscoped on purpose.
 */
import { createContext, useContext } from 'react'

export type StorageScope = { storeId: string; userId: string }

export const StorageScopeContext = createContext<StorageScope | null>(null)

/**
 * The unscoped keys used before stored values were scoped. Their owner store is unknown, so they are never
 * migrated: they are removed once and forgotten.
 */
export const LEGACY_UNSCOPED_KEYS = {
  local: ['media.pick.recent', 'customize.link.recent', 'home-suggestions-dismissed'],
  session: ['customize.clipboard', 'admin-answer-report:v1', 'setup_next_shown_done'],
} as const

/** Old "<provider>-connect-tested" flags: any provider id, so matched by shape. */
const LEGACY_TESTED_FLAG = /^[a-z0-9_-]+-connect-tested$/
/** Old per-email activity marks (`activity-seen:<email>`), now per store and member. */
const LEGACY_ACTIVITY_SEEN = /^activity-seen:[^:]+@[^:]+$/
/** Lists that were scoped by only one of store or member (now both). */
const LEGACY_HALF_SCOPED = /^admin-(palette-recents|recent-apps):v1:/
const LEGACY_SESSION = /^admin-assistant:v1:/

/** Removes the old unscoped keys; harmless to run again, quiet where storage is blocked. */
export function dropLegacyUnscopedKeys(): void {
  try {
    const local = window.localStorage
    for (const key of LEGACY_UNSCOPED_KEYS.local) local.removeItem(key)
    const stale: string[] = []
    for (let i = 0; i < local.length; i++) {
      const key = local.key(i)
      if (
        key &&
        (LEGACY_TESTED_FLAG.test(key) ||
          LEGACY_ACTIVITY_SEEN.test(key) ||
          LEGACY_HALF_SCOPED.test(key))
      ) {
        stale.push(key)
      }
    }
    for (const key of stale) local.removeItem(key)
  } catch {
    // Blocked storage holds nothing old either.
  }
  try {
    const session = window.sessionStorage
    for (const key of LEGACY_UNSCOPED_KEYS.session) session.removeItem(key)
    const stale: string[] = []
    for (let i = 0; i < session.length; i++) {
      const key = session.key(i)
      if (key && LEGACY_SESSION.test(key)) stale.push(key)
    }
    for (const key of stale) session.removeItem(key)
  } catch {
    // Same.
  }
}

/**
 * The key for a stored value that belongs to one store (and, with `perUser`, one member of it).
 * Null without a scope: callers then neither read nor write, so nothing leaks across stores.
 */
export function scopedStorageKey(
  base: string,
  scope: StorageScope | null,
  { perUser = true }: { perUser?: boolean } = {},
): string | null {
  if (!scope?.storeId) return null
  if (!perUser) return `${base}:store:${scope.storeId}`
  if (!scope.userId) return null
  return `${base}:store:${scope.storeId}:user:${scope.userId}`
}

/** `scopedStorageKey` for the current store and member: a key, or null before a store is picked. */
export function useScopedStorageKey(base: string, options?: { perUser?: boolean }): string | null {
  return scopedStorageKey(base, useStorageScope(), options)
}

/** The store and member stored values belong to; null before a store is picked. */
export function useStorageScope(): StorageScope | null {
  return useContext(StorageScopeContext)
}
