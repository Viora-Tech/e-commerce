import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import { returnDetailContent as copy, returnsContent } from '@/data/returns'
import { formatPaise } from '@/lib/money'
import type { ReturnDetail } from './return-types'

type ReturnCustomerCardProps = { detail: ReturnDetail }

/** The order and the customer behind the return, plus how the parcel travels. */
export default function ReturnCustomerCard({ detail: r }: ReturnCustomerCardProps) {
  // Render logic
  const o = r.order
  const a = o.address
  const courierLabel =
    r.pickupCouriers.find((c) => c.id === r.pickupProvider)?.label ?? r.pickupProvider ?? ''

  return (
    <>
      <DataCard
        title={copy.order}
        action={
          <Link href={`/orders/${o.id}`} className="text-body text-link hover:underline">
            {copy.openOrder}
          </Link>
        }
      >
        <p className="text-body text-foreground">{copy.forOrder(o.number)}</p>
        <p className="text-caption text-muted-foreground">
          {copy.orderTotal(formatPaise(o.totalPaise))}
        </p>
      </DataCard>
      <DataCard title={copy.customer}>
        <div className="flex flex-col gap-1 text-body">
          <span className="text-foreground">
            {o.customerName ?? o.email ?? returnsContent.guest}
          </span>
          {o.email ? <span className="text-muted-foreground">{o.email}</span> : null}
          {o.phone ? <span className="text-muted-foreground">{o.phone}</span> : null}
        </div>
        {a ? (
          <div className="mt-4 flex flex-col gap-0.5 text-body">
            <span className="text-caption text-muted-foreground">{copy.shipTo}</span>
            <span>{a.name}</span>
            <span>{[a.line1, a.line2].filter(Boolean).join(', ')}</span>
            <span>
              {a.city}, {a.stateCode} {a.pincode}
            </span>
            <span>{a.phone}</span>
          </div>
        ) : null}
      </DataCard>
      {r.pickupMethod ? (
        <DataCard title={copy.pickup.title}>
          <p className="text-body">
            {r.pickupMethod === 'courier' && r.pickupWaybill
              ? copy.pickup.courier(courierLabel, r.pickupWaybill)
              : copy.pickup.customer}
          </p>
          {r.pickupLabelUrl ? (
            <a
              href={r.pickupLabelUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-block text-body text-link hover:underline"
            >
              {copy.pickup.label}
            </a>
          ) : null}
        </DataCard>
      ) : null}
    </>
  )
}
