import type { DashboardSummary, HomeFacts } from '@commerce/api'
import type { HomeTodo } from '@commerce/core/home-todos'
import type { StoreHealthReport } from '@commerce/core/store-health'
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
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import IconBadge from '@/components/layout/icon-badge'
import SectionHead from '@/components/layout/section-head'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import { homeContent } from '@/data/home'
import { homeSectionsContent } from '@/data/home-sections'
import { getCopy } from '@/lib/copy-server'
import { routes } from '@/lib/routes'
import EditTodosDialog from './edit-todos-dialog'
import HomeSlimRow from './home-slim-row'
import { HOME_SECTION, TODO_GRID, TODO_TILE } from './home-layout'
import { shipWaitDays } from './ship-age'
import StoreHealthRow from './store-health-row'

type NeedsYouProps = {
  needsYou: DashboardSummary['needsYou']
  /** To-dos this store hid with "Edit to-dos"; null when the setting could not be read. */
  hidden: HomeTodo[] | null
  /** Store health; null when the member cannot read settings (its row hides). */
  health: StoreHealthReport | null
  /** Old to-ship orders and out-of-stock products; null when they could not be read. */
  extras: HomeFacts | null
}

type Queue = { count: number; href: string } | null

type RowCopy = { label: (n: number) => string; help: string; cta: string }

type Chip = { label: string; tone: ChipTone }

type Row = {
  key: string
  icon: IconComponent
  label: string
  help: string
  cta: string
  href: string
  /** A chip under the help line: "Oldest 2 days" on Ship, "1 out of stock" on Restock. */
  chip: Chip | null
}

type Sections = (typeof homeSectionsContent)['needsYou']

/** Each to-do's queue, its copy and its chip, in the order the tiles show. */
function queues(
  needsYou: NeedsYouProps['needsYou'],
  c: (typeof homeContent)['needsYou']['rows'],
  s: Sections,
  extras: HomeFacts | null,
): { key: HomeTodo; icon: IconComponent; queue: Queue; copy: RowCopy; chip: Chip | null }[] {
  const ship = needsYou.ordersToShip
  const waited = shipWaitDays(ship.oldestAt)
  const out = extras?.outOfStock ?? 0
  return [
    {
      key: 'ship',
      icon: Truck,
      queue: ship,
      copy: c.ordersToShip,
      chip: waited ? { label: s.oldest(waited), tone: 'attention' } : null,
    },
    { key: 'unpaid', icon: CreditCard, queue: needsYou.unpaid, copy: c.unpaid, chip: null },
    { key: 'upi', icon: QrCodeIcon, queue: needsYou.upiToVerify, copy: c.upiToVerify, chip: null },
    {
      key: 'balance',
      icon: Clock,
      queue: needsYou.preorderBalanceDue,
      copy: c.preorderBalanceDue,
      chip: null,
    },
    {
      key: 'preorderShip',
      icon: Package,
      queue: needsYou.preorderShipSoon,
      copy: c.preorderShipSoon,
      chip: null,
    },
    {
      key: 'returns',
      icon: RotateCcw,
      queue: needsYou.returnsToReview,
      copy: c.returnsToReview,
      chip: null,
    },
    { key: 'gst', icon: ReceiptIcon, queue: needsYou.gstQueued, copy: c.gstQueued, chip: null },
    {
      key: 'stock',
      icon: WarningIcon,
      queue: needsYou.lowStock,
      copy: c.lowStock,
      chip: out > 0 ? { label: s.outOfStock(out), tone: 'danger' } : null,
    },
  ]
}

/** Live rows only: a hidden to-do or a zero-count queue has nothing to show. */
function buildRows(
  props: NeedsYouProps,
  c: (typeof homeContent)['needsYou']['rows'],
  s: Sections,
): Row[] {
  const hidden = props.hidden ?? []
  return queues(props.needsYou, c, s, props.extras).flatMap(({ key, icon, queue, copy, chip }) =>
    queue && queue.count > 0 && !hidden.includes(key)
      ? [
          {
            key,
            icon,
            label: copy.label(queue.count),
            help: copy.help,
            cta: copy.cta,
            href: queue.href,
            chip,
          },
        ]
      : [],
  )
}

/**
 * "Needs you" (Figma "Home · Redesign 19 Nov" 1044:11219): one tile per real, actionable queue
 * (orders to ship, payments to collect, UPI payments to check, pre-order balances and shipments,
 * returns, GST invoices, restock), four across from `xl`, each with its button at the foot. The
 * store picks which ones show ("Edit to-dos", #1006). Under the tiles: Store health as one slim
 * row, and a row for orders over 30 days old that still say To ship (only when there are any).
 * Ship's count and its age both come from `needsYou.ordersToShip`, the one read on the page.
 */
export default async function NeedsYou(props: NeedsYouProps) {
  // Render logic
  const c = (await getCopy(homeContent)).needsYou
  const sections = await getCopy(homeSectionsContent)
  const s = sections.needsYou
  const rows = buildRows(props, c.rows, s)
  const shipShown = rows.some((r) => r.key === 'ship')
  const waited = shipShown ? shipWaitDays(props.needsYou.ordersToShip.oldestAt) : null
  const jobs = s.jobs(rows.length)
  const aside = waited ? `${jobs} · ${s.oldestWaiting(waited)}` : jobs
  const stale = props.extras?.staleToShip
  const staleHref = stale
    ? `${routes.orders.list()}?status=unfulfilled&date=custom:..${stale.lastDay}`
    : ''

  return (
    <section className={HOME_SECTION}>
      <SectionHead
        title={s.title}
        action={
          <div className="flex items-center gap-3">
            {rows.length > 0 ? (
              <span className="text-body text-muted-foreground">{aside}</span>
            ) : null}
            {props.hidden ? <EditTodosDialog hidden={props.hidden} /> : null}
          </div>
        }
      />
      {rows.length === 0 ? (
        <Card inset={4} gap={3} className="flex-row items-center">
          <IconBadge icon={CircleCheckIcon} tone="success" />
          <div>
            <p className="text-body-strong text-ink-strong">{c.allClearHeading}</p>
            <p className="text-body text-muted-foreground">{c.allClearBody}</p>
          </div>
        </Card>
      ) : (
        <ul className={TODO_GRID}>
          {rows.map((row) => (
            <li key={row.key} className={`${TODO_TILE} card-lift`}>
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground shadow-input [&_svg]:size-5">
                <row.icon aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-card-title text-ink-strong">{row.label}</p>
                <p className="text-caption font-normal leading-[1.1875rem] text-muted-foreground">
                  {row.help}
                </p>
                {row.chip ? (
                  <StatusChip tone={row.chip.tone} className="mt-1 w-fit">
                    {row.chip.label}
                  </StatusChip>
                ) : null}
              </div>
              {/* Pinned to the tile's foot, so the buttons line up across a row of tiles. */}
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={row.href} />}
                className="mt-auto"
              >
                {row.cta}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {props.health ? <StoreHealthRow report={props.health} /> : null}
      {stale && stale.count > 0 ? (
        <HomeSlimRow
          tone="neutral"
          lead={sections.oldOrders.lead(stale.count)}
          text={sections.oldOrders.body}
          action={
            /* For now this opens those orders on the list; marking them in bulk comes later. */
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={staleHref} />}
            >
              {sections.oldOrders.cta}
            </Button>
          }
        />
      ) : null}
    </section>
  )
}
