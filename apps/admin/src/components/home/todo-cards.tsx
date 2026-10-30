import type { DashboardSummary } from '@commerce/api'
import type { HomeTodo } from '@commerce/core/home-todos'
import {
  CircleCheckIcon,
  Clock,
  CreditCard,
  type IconComponent,
  Package,
  QrCodeIcon,
  ReceiptIcon,
  RotateCcw,
  Truck,
  WarningIcon,
} from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import IconBadge from '@/components/layout/icon-badge'
import SectionHead from '@/components/layout/section-head'
import StatusChip from '@/components/layout/status-chip'
import { homeContent, homePageContent } from '@/data/home'
import { getCopy } from '@/lib/copy-server'
import EditTodosDialog from './edit-todos-dialog'

type TodoCardsProps = {
  needsYou: DashboardSummary['needsYou']
  /** To-dos this store hid with "Edit to-dos"; null when the setting could not be read. */
  hidden: HomeTodo[] | null
}

type Queue = { count: number; href: string } | null

type RowCopy = { label: (n: number) => string; help: string; cta: string }

type Row = {
  key: string
  icon: IconComponent
  label: string
  help: string
  cta: string
  href: string
  /** A warning chip under the help line ("Waiting 3 days"). */
  badge?: string | undefined
}

const DAY_MS = 86_400_000

/** "Waiting 3 days" once the oldest order to ship has waited a full day. */
function waitingBadge(
  oldestAt: Date | string | null,
  waiting: (days: number) => string,
): string | undefined {
  if (!oldestAt) return undefined
  const days = Math.floor((Date.now() - new Date(oldestAt).getTime()) / DAY_MS)
  return days >= 1 ? waiting(days) : undefined
}

/** Each to-do's queue and its copy, in the order the cards show. */
function queues(
  needsYou: TodoCardsProps['needsYou'],
  c: (typeof homeContent)['needsYou']['rows'],
): { key: HomeTodo; icon: IconComponent; queue: Queue; copy: RowCopy; badge?: string }[] {
  const ship = needsYou.ordersToShip
  const shipBadge = waitingBadge(ship.oldestAt, c.ordersToShip.waiting)
  return [
    {
      key: 'ship',
      icon: Truck,
      queue: ship,
      copy: c.ordersToShip,
      ...(shipBadge ? { badge: shipBadge } : {}),
    },
    { key: 'unpaid', icon: CreditCard, queue: needsYou.unpaid, copy: c.unpaid },
    { key: 'upi', icon: QrCodeIcon, queue: needsYou.upiToVerify, copy: c.upiToVerify },
    { key: 'balance', icon: Clock, queue: needsYou.preorderBalanceDue, copy: c.preorderBalanceDue },
    {
      key: 'preorderShip',
      icon: Package,
      queue: needsYou.preorderShipSoon,
      copy: c.preorderShipSoon,
    },
    { key: 'returns', icon: RotateCcw, queue: needsYou.returnsToReview, copy: c.returnsToReview },
    { key: 'gst', icon: ReceiptIcon, queue: needsYou.gstQueued, copy: c.gstQueued },
    { key: 'stock', icon: WarningIcon, queue: needsYou.lowStock, copy: c.lowStock },
  ]
}

/** Live rows only: a hidden to-do or a zero-count queue has nothing to show. */
function buildRows(
  needsYou: TodoCardsProps['needsYou'],
  c: (typeof homeContent)['needsYou']['rows'],
  hidden: HomeTodo[],
): Row[] {
  return queues(needsYou, c).flatMap(({ key, icon, queue, copy, badge }) =>
    queue && queue.count > 0 && !hidden.includes(key)
      ? [
          {
            key,
            icon,
            label: copy.label(queue.count),
            help: copy.help,
            cta: copy.cta,
            href: queue.href,
            badge,
          },
        ]
      : [],
  )
}

/**
 * "To do": one card per real, actionable queue (orders to ship, payments to collect, UPI
 * payments to check, pre-order balances and shipments, returns, GST invoices, low stock), each
 * with its action button. The store picks which ones show ("Edit to-dos", #1006). Nothing to do
 * shows one calm "all caught up" card instead of an empty row.
 */
export default async function TodoCards({ needsYou, hidden }: TodoCardsProps) {
  // Render logic
  const c = (await getCopy(homeContent)).needsYou
  const page = (await getCopy(homePageContent)).todo
  const rows = buildRows(needsYou, c.rows, hidden ?? [])

  return (
    <section className="flex flex-col gap-3.5">
      <SectionHead
        title={page.title}
        action={
          <div className="flex items-center gap-3">
            {rows.length > 0 ? (
              <span className="text-body text-muted-foreground">{page.count(rows.length)}</span>
            ) : null}
            {hidden ? <EditTodosDialog hidden={hidden} /> : null}
          </div>
        }
      />
      {rows.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg surface-card p-4">
          <IconBadge icon={CircleCheckIcon} tone="success" />
          <div>
            <p className="text-body-strong text-ink-strong">{c.allClearHeading}</p>
            <p className="text-body text-muted-foreground">{c.allClearBody}</p>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex h-full flex-col items-start gap-3.5 rounded-lg p-5 surface-card card-lift"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground shadow-input [&_svg]:size-5">
                <row.icon aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-base leading-5 font-semibold text-ink-strong">{row.label}</p>
                <p className="text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">
                  {row.help}
                </p>
                {row.badge ? (
                  <StatusChip tone="attention" className="mt-1 w-fit">
                    {row.badge}
                  </StatusChip>
                ) : null}
              </div>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={row.href} />}
                className="mt-auto self-end"
              >
                {row.cta}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
