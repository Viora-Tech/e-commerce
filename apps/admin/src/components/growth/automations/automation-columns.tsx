import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { automationsContent } from '@/data/marketing-automations'
import type { api } from '@/lib/api-client'

export type AutomationRow = Awaited<ReturnType<typeof api.marketing.automations.list>>[number]

type Copy = typeof automationsContent

/** Columns of the automations list (Figma "Marketing / Automations list"). */
export function automationColumns(copy: Copy): ResourceColumnSpec<AutomationRow>[] {
  return [
    {
      id: 'name',
      title: copy.columns.name,
      hideable: false,
      align: 'start',
      className: 'w-96 px-3 whitespace-normal',
      sortValue: (a) => a.name,
      render: (a) => (
        <span className="flex flex-col text-left">
          <span className="text-body-strong">{a.name}</span>
          <span className="text-caption text-muted-foreground">
            {copy.triggers[a.trigger as keyof typeof copy.triggers] ?? a.trigger}
          </span>
        </span>
      ),
    },
    {
      id: 'steps',
      title: copy.columns.steps,
      render: (a) => <span className="tabular-nums">{copy.stepCount(a.steps.length)}</span>,
    },
    {
      id: 'orders',
      title: copy.columns.ordersFrom,
      sortValue: (a) => a.stats.orders,
      render: (a) => <span className="tabular-nums">{copy.ordersFrom(a.stats.orders)}</span>,
    },
    {
      id: 'status',
      title: copy.columns.status,
      align: 'center',
      render: (a) => <StatusChip>{copy.status[a.status]}</StatusChip>,
    },
    {
      id: 'updated',
      title: copy.columns.updated,
      align: 'end',
      sortValue: (a) => new Date(a.updatedAt).getTime(),
      render: (a) => <RelativeTime value={a.updatedAt} />,
    },
  ]
}
