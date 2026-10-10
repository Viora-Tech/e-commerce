import type { AppSummary } from '@/components/apps/app-card'

/** How many apps the "Recommended for <store>" strip shows. */
export const RECOMMENDED_LIMIT = 3

type Gap = {
  /** Candidates for this gap, best first; the first one not installed is recommended. */
  apps: readonly string[]
  /** A store is covered when it has any app providing this kind (e.g. a courier). */
  kind?: 'payments' | 'shipping' | 'notifications'
}

/** Gaps a store commonly has, most valuable first. Ids are plugin ids from commerce.config.ts. */
const GAPS: readonly Gap[] = [
  { apps: ['delhivery', 'shiprocket', 'rapidshyp'], kind: 'shipping' },
  { apps: ['reviews'] },
  { apps: ['whatsapp'], kind: 'notifications' },
  { apps: ['gst-invoices'] },
  { apps: ['back-in-stock'] },
  { apps: ['razorpay', 'cashfree'], kind: 'payments' },
]

/**
 * Not-installed apps for the categories this store lacks: no courier suggests Delhivery, no
 * reviews suggests Reviews, and so on. One app per gap, at most `RECOMMENDED_LIMIT`.
 */
export function recommendedApps(apps: AppSummary[]): AppSummary[] {
  const byId = new Map(apps.map((a) => [a.id, a]))
  const installed = apps.filter((a) => a.installed)
  const picks: AppSummary[] = []
  for (const gap of GAPS) {
    const covered = installed.some(
      (a) => gap.apps.includes(a.id) || (gap.kind !== undefined && a.provides[gap.kind].length > 0),
    )
    if (covered) continue
    const pick = gap.apps.map((id) => byId.get(id)).find((a) => a && !a.installed)
    if (pick) picks.push(pick)
    if (picks.length === RECOMMENDED_LIMIT) break
  }
  return picks
}
