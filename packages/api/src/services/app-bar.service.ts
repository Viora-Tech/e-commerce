import { courierActivity } from '@commerce/core'
import type { Permission } from '@commerce/core/permissions'
import { getRegistries } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import type { AppBarSummary } from '@commerce/plugins'

/** One installed app's app bar extras, as `store.shell` returns them. */
export type AppBarExtras = {
  statusPill: {
    label: string
    tone: 'neutral' | 'success' | 'attention' | 'danger'
    at: Date | null
  } | null
  pageCounts: Record<string, number>
}

/** Drops empty pills, non-finite and zero counts, so the admin draws only what has something to say. */
function clean(summary: AppBarSummary | null): AppBarExtras | null {
  if (!summary) return null
  const pill = summary.statusPill
  const label = pill?.label.trim() ?? ''
  const pageCounts = Object.fromEntries(
    Object.entries(summary.pageCounts ?? {}).filter(([, n]) => Number.isFinite(n) && n > 0),
  )
  if (!label && Object.keys(pageCounts).length === 0) return null
  return {
    statusPill: label ? { label, tone: pill?.tone ?? 'neutral', at: pill?.at ?? null } : null,
    pageCounts,
  }
}

/** How long one app's extras are reused for a store: counts a minute old are fine for a sidebar. */
export const APP_BAR_TTL_MS = 60_000
/** Entries kept per process (store × app); the oldest go first. */
const APP_BAR_CACHE_MAX = 500

type CachedBar = {
  at: number
  /** Each permission the read asked about, with the answer it got. */
  asked: Map<string, boolean>
  extras: AppBarExtras | null
}

/**
 * Per-process cache of each app's extras by store (owner, 13 Nov 2026: the reads cost every admin
 * page a few statements). The read may show a count only to members who can see it, so an entry
 * remembers every permission the read asked about and is reused only for a member who gets the
 * same answers; anyone else reads afresh (and their answer replaces it).
 */
const barCache = new Map<string, CachedBar>()

/** Clears the cache (tests). */
export function clearAppBarCache(): void {
  barCache.clear()
}

function cachedBar(key: string, can: (permission: Permission) => boolean, now: number) {
  const hit = barCache.get(key)
  if (!hit || now - hit.at > APP_BAR_TTL_MS) return undefined
  for (const [perm, answer] of hit.asked) if (can(perm as Permission) !== answer) return undefined
  return hit.extras
}

function rememberBar(key: string, entry: CachedBar): void {
  barCache.delete(key)
  barCache.set(key, entry)
  while (barCache.size > APP_BAR_CACHE_MAX) {
    const oldest = barCache.keys().next().value
    if (oldest === undefined) break
    barCache.delete(oldest)
  }
}

/**
 * The app bar extras (status pill, sidebar page counts) of every installed app that declares an
 * `appBar` read, keyed by app id. Runs inside `store.shell`, so every admin page pays for it:
 * only installed apps with the hook are asked, each with one statement in a savepoint (a failed
 * read must not abort the shell's transaction; that app just shows no extras), and each answer
 * is reused for a minute (`APP_BAR_TTL_MS`). A store with none of these apps runs no statement.
 */
export async function installedAppBars(
  tx: StoreTx,
  storeId: string,
  installedIds: ReadonlySet<string>,
  can: (permission: Permission) => boolean,
  now = Date.now(),
): Promise<Record<string, AppBarExtras>> {
  const out: Record<string, AppBarExtras> = {}
  for (const p of getRegistries().plugins) {
    const read = p.appBar
    if (!read || !installedIds.has(p.id)) continue
    const key = `${storeId}:${p.id}`
    const cached = cachedBar(key, can, now)
    if (cached !== undefined) {
      if (cached) out[p.id] = cached
      continue
    }
    const asked = new Map<string, boolean>()
    const ask = (perm: string) => {
      const answer = can(perm as Permission)
      asked.set(perm, answer)
      return answer
    }
    let failed = false
    const summary = await tx
      .transaction((sp) =>
        read({
          tx: sp,
          storeId,
          can: ask,
          courierActivity: (provider) => courierActivity(sp, storeId, provider),
        }),
      )
      .catch(() => {
        failed = true
        return null
      })
    const extras = clean(summary)
    // A failed read is asked again next time rather than remembered as "nothing to show".
    if (!failed) rememberBar(key, { at: now, asked, extras })
    if (extras) out[p.id] = extras
  }
  return out
}
