'use client'

import { returnActions } from '@commerce/core/returns'
import { Clock, Undo } from '@commerce/ui/icons'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/layout/page-header'
import OrderChip from '@/components/orders/order-chip'
import OrderPageFrame from '@/components/orders/order-page-frame'
import { returnDetailContent as copy, returnsContent } from '@/data/returns'
import { formatWhen } from '@/lib/format-date'
import { routes } from '@/lib/routes'
import ReturnCustomerCard from './return-customer-card'
import ReturnDecisionCard from './return-decision-card'
import ReturnItemsCard from './return-items-card'
import ReturnOutcomeCard from './return-outcome-card'
import ReturnReasonCard from './return-reason-card'
import ReturnResolveCard from './return-resolve-card'
import ReturnTimelineCard from './return-timeline-card'
import type { ReturnDetail } from './return-types'
import RtoCard from './rto-card'

type ReturnViewProps = { detail: ReturnDetail }

function headerTone(r: ReturnDetail) {
  if (r.status === 'resolved') return 'success' as const
  if (r.status === 'rejected' || r.kind === 'rto') return 'danger' as const
  if (r.status === 'in_transit' || r.status === 'approved') return 'info' as const
  return 'warning' as const
}

/** Orders → Returns → one return (or RTO task): what came back and the one next step. */
export default function ReturnView({ detail: r }: ReturnViewProps) {
  // Hooks
  const router = useRouter()

  // Helpers
  const refresh = () => router.refresh()

  // Render logic
  const rto = r.kind === 'rto'
  const can = returnActions(r)
  const title = rto ? copy.rtoHeading(r.label) : copy.heading(r.label)
  const statusLabel = rto ? returnsContent.rtoStatus[r.status] : undefined

  return (
    <OrderPageFrame
      header={
        <PageHeader
          title={title}
          back={{ label: copy.back, href: routes.orders.returns() }}
          badges={<OrderChip kind="return" value={r.status} label={statusLabel} />}
          subtitle={
            <span className="flex items-center gap-1">
              <Clock className="size-3.5 text-muted-foreground" />
              {rto
                ? copy.cameBackOn(formatWhen(r.receivedAt ?? r.requestedAt))
                : copy.askedOn(formatWhen(r.requestedAt))}
            </span>
          }
          lead={{ kind: 'icon', node: <Undo aria-hidden="true" />, tone: headerTone(r) }}
        />
      }
      main={
        <>
          {rto ? <RtoCard detail={r} onChanged={refresh} /> : null}
          <ReturnItemsCard detail={r} />
          {rto ? null : <ReturnReasonCard detail={r} />}
          {can.approve || can.reject || can.arrangePickup || can.receive ? (
            <ReturnDecisionCard detail={r} can={can} onChanged={refresh} />
          ) : null}
          {can.resolve ? <ReturnResolveCard detail={r} onChanged={refresh} /> : null}
          {r.status === 'resolved' ? <ReturnOutcomeCard detail={r} onChanged={refresh} /> : null}
        </>
      }
      side={
        <>
          <ReturnTimelineCard detail={r} />
          <ReturnCustomerCard detail={r} />
        </>
      }
    />
  )
}
