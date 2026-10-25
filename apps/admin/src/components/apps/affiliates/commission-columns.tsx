import CommissionRowActions from '@/components/apps/affiliates/commission-row-actions'
import { commissionTone } from '@/components/apps/affiliates/tones'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { affiliatesContent } from '@/data/affiliates'
import type { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'

export type CommissionRow = Awaited<ReturnType<typeof api.affiliates.commissions.list>>[number]

/** Columns of the commissions ledger, also on an affiliate's page (without the affiliate). */
export function commissionColumns(
  copy: typeof affiliatesContent,
  f: Formatters,
  onChanged: () => void,
  opts: { withAffiliate: boolean },
): ResourceColumnSpec<CommissionRow>[] {
  const c = copy.commissions.columns
  const why = (r: CommissionRow) =>
    r.flag ? copy.flags[r.flag] : r.reversedReason ? copy.reasons[r.reversedReason] : null
  const columns: (ResourceColumnSpec<CommissionRow> | null)[] = [
    {
      id: 'order',
      title: c.order,
      hideable: false,
      align: 'start',
      sortValue: (r) => r.orderNumber,
      render: (r) => (
        <span className="flex flex-col text-left">
          <span className="font-medium">#{r.orderNumber}</span>
          <RelativeTime value={r.placedAt} />
        </span>
      ),
    },
    opts.withAffiliate
      ? {
          id: 'affiliate',
          title: c.affiliate,
          align: 'start',
          sortValue: (r) => r.affiliateName,
          render: (r) => <span>{r.affiliateName || r.affiliateCode}</span>,
        }
      : null,
    { id: 'source', title: c.source, render: (r) => copy.source[r.source] ?? r.source },
    {
      id: 'status',
      title: c.status,
      sortValue: (r) => r.status,
      render: (r) => (
        <span className="flex flex-col items-start gap-1">
          <StatusChip tone={r.flag ? 'danger' : commissionTone(r.status)}>
            {copy.commissionStatus[r.status] ?? r.status}
          </StatusChip>
          {why(r) ? <span className="text-caption text-muted-foreground">{why(r)}</span> : null}
        </span>
      ),
    },
    {
      id: 'sale',
      title: c.sale,
      sortValue: (r) => r.basePaise,
      render: (r) => f.money(r.basePaise),
    },
    {
      id: 'commission',
      title: c.commission,
      sortValue: (r) => r.commissionPaise,
      render: (r) => f.money(r.commissionPaise),
    },
    { id: 'tds', title: c.tds, render: (r) => (r.tdsPaise ? f.money(r.tdsPaise) : '—') },
    {
      id: 'eligible',
      title: c.eligible,
      render: (r) =>
        r.eligibleAt
          ? f.date(r.eligibleAt)
          : r.status === 'pending'
            ? copy.commissions.notDelivered
            : '—',
    },
    {
      id: 'actions',
      title: '',
      hideable: false,
      render: (r) => (
        <CommissionRowActions
          id={r.id}
          status={r.status}
          flag={r.flag}
          paid={Boolean(r.payoutId)}
          onChanged={onChanged}
        />
      ),
    },
  ]
  return columns.filter((col): col is ResourceColumnSpec<CommissionRow> => col !== null)
}
