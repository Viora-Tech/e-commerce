import type { ImportResource, ResourceProgress } from '@commerce/plugin-shopify-import/client'
import type { api } from '@/lib/api-client'

export type RunListItem = Awaited<ReturnType<typeof api.shopifyImport.runs>>['items'][number]
export type RunDetail = NonNullable<Awaited<ReturnType<typeof api.shopifyImport.run>>>
export type IssueItem = Awaited<ReturnType<typeof api.shopifyImport.issues>>['items'][number]

type Progress = Partial<Record<ImportResource, ResourceProgress>>

/** Sum of every resource's counters. */
export function totals(progress: Progress): ResourceProgress {
  const sum: ResourceProgress = {
    total: 0,
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  }
  for (const p of Object.values(progress)) {
    if (!p) continue
    sum.total += p.total
    sum.processed += p.processed
    sum.created += p.created
    sum.updated += p.updated
    sum.skipped += p.skipped
    sum.failed += p.failed
  }
  return sum
}
