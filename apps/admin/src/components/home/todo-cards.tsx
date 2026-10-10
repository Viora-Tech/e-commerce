import type { DashboardSummary } from '@commerce/api'
import {
  CircleCheckIcon,
  Clock,
  type IconComponent,
  QrCodeIcon,
  ReceiptIcon,
  Truck,
  WarningIcon,
} from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import IconBadge from '@/components/layout/icon-badge'
import { homeContent, homePageContent } from '@/data/home'
import { getCopy } from '@/lib/copy-server'
import SectionHead from './section-head'

type TodoCardsProps = {
  needsYou: DashboardSummary['needsYou']
}

type Row = {
  key: string
  icon: IconComponent
  label: string
  help: string
  cta: string
  href: string
}

/** Live rows only: a zero-count queue has nothing to act on. */
function buildRows(
  needsYou: TodoCardsProps['needsYou'],
  c: (typeof homeContent)['needsYou']['rows'],
): Row[] {
  const rows: Row[] = []
  if (needsYou.ordersToShip.count > 0) {
    rows.push({
      key: 'ship',
      icon: Truck,
      label: c.ordersToShip.label(needsYou.ordersToShip.count),
      help: c.ordersToShip.help,
      cta: c.ordersToShip.cta,
      href: needsYou.ordersToShip.href,
    })
  }
  if (needsYou.upiToVerify.count > 0) {
    rows.push({
      key: 'upi',
      icon: QrCodeIcon,
      label: c.upiToVerify.label(needsYou.upiToVerify.count),
      help: c.upiToVerify.help,
      cta: c.upiToVerify.cta,
      href: needsYou.upiToVerify.href,
    })
  }
  if (needsYou.gstQueued && needsYou.gstQueued.count > 0) {
    rows.push({
      key: 'gst',
      icon: ReceiptIcon,
      label: c.gstQueued.label(needsYou.gstQueued.count),
      help: c.gstQueued.help,
      cta: c.gstQueued.cta,
      href: needsYou.gstQueued.href,
    })
  }
  if (needsYou.lowStock.count > 0) {
    rows.push({
      key: 'stock',
      icon: WarningIcon,
      label: c.lowStock.label(needsYou.lowStock.count),
      help: c.lowStock.help,
      cta: c.lowStock.cta,
      href: needsYou.lowStock.href,
    })
  }
  if (needsYou.preorderBalanceDue.count > 0) {
    rows.push({
      key: 'balance',
      icon: Clock,
      label: c.preorderBalanceDue.label(needsYou.preorderBalanceDue.count),
      help: c.preorderBalanceDue.help,
      cta: c.preorderBalanceDue.cta,
      href: needsYou.preorderBalanceDue.href,
    })
  }
  return rows
}

/**
 * "To do": one card per real, actionable queue (orders to ship, UPI payments to check, GST
 * invoices to issue, low stock, pre-order balances due), each with its action button. Nothing
 * to do shows one calm "all caught up" card instead of an empty row.
 */
export default async function TodoCards({ needsYou }: TodoCardsProps) {
  // Render logic
  const c = (await getCopy(homeContent)).needsYou
  const page = (await getCopy(homePageContent)).todo
  const rows = buildRows(needsYou, c.rows)

  return (
    <section className="flex flex-col gap-3.5">
      <SectionHead title={page.title} aside={rows.length > 0 ? page.count(rows.length) : null} />
      {rows.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl surface-card p-4">
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
              className="flex flex-col items-start gap-3.5 rounded-xl surface-card p-5"
            >
              {/* Figma 226:537: 40px square tile, 12px corners, soft brand fill. */}
              <span className="flex size-10 items-center justify-center rounded-[0.75rem] bg-primary-soft text-primary [&_svg]:size-5">
                <row.icon aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-card-title text-ink-strong">{row.label}</p>
                <p className="text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">
                  {row.help}
                </p>
              </div>
              <Button variant="outline" nativeButton={false} render={<Link href={row.href} />}>
                {row.cta}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
