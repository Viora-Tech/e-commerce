import type { PrivacyAuditEntry } from '@commerce/core'
import EmptyState from '@/components/layout/empty-state'
import { auditContent, STATUS_LABEL } from '@/data/customer-privacy'
import { useCopy } from '@/hooks/use-copy'
import { formatDateTime } from '@/lib/format-date'

type AuditTrailProps = { entries: PrivacyAuditEntry[] }

/** Who did what and when, newest first: the privacy audit trail. */
export default function AuditTrail({ entries }: AuditTrailProps) {
  // Hooks
  const copy = useCopy(auditContent)

  // Derived
  const statusName = (s: unknown) =>
    typeof s === 'string' && s in STATUS_LABEL
      ? STATUS_LABEL[s as keyof typeof STATUS_LABEL]
      : String(s)
  /** The extra words after the action: which status, which format, what was kept. */
  function extra(entry: PrivacyAuditEntry): string | null {
    const d = entry.detail ?? {}
    if (entry.action === 'request.status') return copy.status(statusName(d.from), statusName(d.to))
    if (entry.action === 'export.downloaded' && typeof d.format === 'string')
      return copy.format(d.format)
    if (entry.action === 'customer.anonymised' && typeof d.ordersKept === 'number') {
      return copy.kept(d.ordersKept)
    }
    return null
  }

  // Early returns
  if (entries.length === 0) return <EmptyState variant="inline" body={copy.empty} />

  // Render logic
  return (
    <ol className="flex flex-col gap-3">
      {entries.map((e) => {
        const who =
          e.actorType === 'customer'
            ? copy.customer
            : e.actorType === 'system'
              ? copy.system
              : (e.actorLabel ?? copy.system)
        const more = extra(e)
        return (
          <li key={e.id} className="flex flex-col gap-0.5 border-l-2 border-border pl-3">
            <span className="text-body">
              <span className="font-medium">{who}</span> {copy.actions[e.action] ?? e.action}
              {more ? <span className="text-muted-foreground"> ({more})</span> : null}
            </span>
            <time
              className="text-caption text-muted-foreground"
              dateTime={new Date(e.createdAt).toISOString()}
            >
              {formatDateTime(new Date(e.createdAt))}
            </time>
          </li>
        )
      })}
    </ol>
  )
}
