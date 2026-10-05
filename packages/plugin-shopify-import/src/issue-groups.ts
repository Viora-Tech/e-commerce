/**
 * A run's problems grouped by cause ("2,100 images not copied: storage isn't
 * connected"), so the run page shows a few lines with one fix each instead of
 * thousands of identical rows. The per-record list stays behind "Show all".
 */
import type { StoreTx } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { IssueCause, IssueGroup } from './client'
import { importIssue } from './schema'

const STORAGE_HREF = '/content/files/storage'
const CONNECT_HREF = '/apps/shopify-import/connect'

/** Why one problem happened, from its kind and message. */
export function causeOf(issue: {
  kind: string | null
  sourceId: string | null
  message: string
}): IssueCause {
  const m = issue.message
  if (/storage isn't writable|EACCES|EROFS|ENOSPC|permission denied/i.test(m)) return 'storage'
  if (/Shopify did not allow reading this/.test(m)) return 'scope'
  if (/already belongs to an order placed in this store/.test(m)) return 'order_number'
  if (issue.kind === 'media' || /^Image .*not copied|^Image was not copied/.test(m)) return 'image'
  if (issue.kind === 'file') return 'file'
  if (issue.sourceId) return 'record'
  return 'note'
}

const FIX: Partial<Record<IssueCause, string>> = { storage: STORAGE_HREF, scope: CONNECT_HREF }
/** Causes with one fix for the whole store: one line, however many types they hit. */
const STORE_WIDE: readonly IssueCause[] = ['storage', 'scope']

export async function issueGroups(tx: StoreTx, runId: string): Promise<IssueGroup[]> {
  const rows = await tx
    .select({
      resource: importIssue.resource,
      kind: importIssue.kind,
      sourceId: importIssue.sourceId,
      message: importIssue.message,
    })
    .from(importIssue)
    .where(eq(importIssue.runId, runId))
  const groups = new Map<string, IssueGroup>()
  for (const row of rows) {
    const cause = causeOf(row)
    const key = STORE_WIDE.includes(cause) ? cause : `${cause}:${row.resource}`
    const group = groups.get(key)
    if (group) {
      group.count++
      if (row.sourceId) group.retryable++
      if (!group.resources.includes(row.resource)) group.resources.push(row.resource)
      continue
    }
    groups.set(key, {
      cause,
      resources: [row.resource],
      count: 1,
      retryable: row.sourceId ? 1 : 0,
      sample: row.message.slice(0, 300),
      fixHref: FIX[cause] ?? null,
    })
  }
  return [...groups.values()].sort((a, b) => b.count - a.count)
}
