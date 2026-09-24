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
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import IconBadge from '@/components/layout/icon-badge'
import { homeContent } from '@/data/home'

type NeedsYouListProps = {
  needsYou: DashboardSummary['needsYou']
}

type Row = {
  key: string
  icon: IconComponent
  tone: 'warning' | 'info' | 'danger'
  label: string
  help: string
  cta: string
  href: string
}

/** Live rows only: a zero-count queue has nothing to act on. */
function buildRows(needsYou: NeedsYouListProps['needsYou']): Row[] {
  const c = homeContent.needsYou.rows
  const rows: Row[] = []
  if (needsYou.ordersToShip.count > 0) {
    rows.push({
      key: 'ship',
      icon: Truck,
      tone: 'info',
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
      tone: 'warning',
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
      tone: 'info',
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
      tone: 'danger',
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
      tone: 'warning',
      label: c.preorderBalanceDue.label(needsYou.preorderBalanceDue.count),
      help: c.preorderBalanceDue.help,
      cta: c.preorderBalanceDue.cta,
      href: needsYou.preorderBalanceDue.href,
    })
  }
  return rows
}

/**
 * The home page's inbox: one row per real, actionable queue (orders to ship,
 * UPI payments to check, GST invoices to issue, low stock, pre-order balances
 * due), each with a plain count and a deep link. Nothing to do shows one calm
 * "all caught up" state instead of an empty list.
 */
export default function NeedsYouList({ needsYou }: NeedsYouListProps) {
  // Render logic
  const c = homeContent.needsYou
  const rows = buildRows(needsYou)

  return (
    <DataCard title={c.title} meta={c.subtitle}>
      {rows.length === 0 ? (
        <div className="flex items-center gap-3 py-2">
          <IconBadge icon={CircleCheckIcon} tone="success" />
          <div>
            <p className="text-body-strong text-ink-strong">{c.allClearHeading}</p>
            <p className="text-body text-muted-foreground">{c.allClearBody}</p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <IconBadge icon={row.icon} tone={row.tone} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-body-strong text-ink-strong">{row.label}</p>
                <p className="truncate text-caption text-muted-foreground">{row.help}</p>
              </div>
              <Link
                href={row.href}
                className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-caption font-medium text-ink-strong shadow-xs transition-colors hover:bg-muted"
              >
                {row.cta}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
