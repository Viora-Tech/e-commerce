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

/**
 * The app bar extras (status pill, sidebar page counts) of every installed app that declares an
 * `appBar` read, keyed by app id. Runs inside `store.shell`, so every admin page pays for it:
 * only installed apps with the hook are asked, each with one statement in a savepoint (a failed
 * read must not abort the shell's transaction; that app just shows no extras). A store with
 * none of these apps installed runs no statement at all.
 */
export async function installedAppBars(
  tx: StoreTx,
  storeId: string,
  installedIds: ReadonlySet<string>,
  can: (permission: Permission) => boolean,
): Promise<Record<string, AppBarExtras>> {
  const out: Record<string, AppBarExtras> = {}
  for (const p of getRegistries().plugins) {
    const read = p.appBar
    if (!read || !installedIds.has(p.id)) continue
    const summary = await tx
      .transaction((sp) =>
        read({
          tx: sp,
          storeId,
          can: (perm) => can(perm as Permission),
          courierActivity: (provider) => courierActivity(sp, storeId, provider),
        }),
      )
      .catch(() => null)
    const extras = clean(summary)
    if (extras) out[p.id] = extras
  }
  return out
}
