import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import LabeledGroup from '@/components/layout/labeled-group'
import { stateName } from '@/data/india'
import { orderDetailContent } from '@/data/orders'
import { returnDetailContent as copy, returnsContent } from '@/data/returns'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'
import type { ReturnDetail } from './return-types'

type ReturnCustomerCardProps = { detail: ReturnDetail }

/** The order and the customer behind the return, plus how the parcel travels. */
export default function ReturnCustomerCard({ detail: r }: ReturnCustomerCardProps) {
  // Render logic
  const o = r.order
  const a = o.address
  const field = orderDetailContent.customer
  const who = o.customerName ?? o.email ?? returnsContent.guest
  const courierLabel =
    r.pickupCouriers.find((c) => c.id === r.pickupProvider)?.label ?? r.pickupProvider ?? ''

  return (
    <>
      <DataCard
        title={copy.order}
        action={
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={routes.orders.detail(o.id)} />}
          >
            <ExternalLink aria-hidden="true" />
            {copy.openOrder}
          </Button>
        }
      >
        <p className="text-body text-foreground">{copy.forOrder(o.number)}</p>
        <p className="text-caption text-muted-foreground">
          {copy.orderTotal(formatPaise(o.totalPaise))}
        </p>
      </DataCard>
      <DataCard title={copy.customer} bodyClassName="flex flex-col gap-4">
        <KeyValueList
          rows={[
            { label: field.name, value: who, copy: true },
            { label: field.email, value: o.email ?? '', copy: true, hidden: !o.email },
            { label: field.phone, value: o.phone ?? '', copy: true, hidden: !o.phone },
          ]}
        />
        {a ? (
          <LabeledGroup label={copy.shipTo}>
            <KeyValueList
              rows={[
                { label: field.line1, value: a.line1, copy: true },
                { label: field.line2, value: a.line2 ?? '', copy: true, hidden: !a.line2 },
                { label: field.city, value: a.city, copy: true },
                { label: field.state, value: stateName(a.stateCode), copy: true },
                { label: field.pincode, value: a.pincode, copy: true },
              ]}
            />
          </LabeledGroup>
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
