import { accountContent } from '@/data/account'
import type { ShopperParcel } from '@/lib/parcels'

type OrderParcelsProps = {
  parcels: ShopperParcel[]
}

const copy = accountContent.order.parcels

/** "Ships in 2 parcels" on the order page: each parcel's items, warehouse and expected dates. */
export default function OrderParcels({ parcels }: OrderParcelsProps) {
  // Early returns
  if (parcels.length < 2) return null

  return (
    <section
      className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-6"
      aria-labelledby="order-parcels"
    >
      <header className="flex flex-col gap-1">
        <h3 id="order-parcels" className="h4">
          {copy.title(parcels.length)}
        </h3>
        <p className="text-small text-muted">{copy.note}</p>
      </header>
      <ol className="flex flex-col divide-y divide-line">
        {parcels.map((p, i) => (
          <li key={p.key} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <p className="text-body">
              <span className="font-semibold">{copy.parcel(i + 1)}</span>{' '}
              <span className="text-muted">{copy.from(p.from)}</span>
            </p>
            <ul className="flex flex-col gap-0.5 text-body">
              {p.items.map((item) => (
                <li key={item.title}>{copy.item(item.quantity, item.title)}</li>
              ))}
            </ul>
            {p.onHold ? (
              <p className="text-small text-muted">{copy.onHold}</p>
            ) : p.dateRange ? (
              <p className="text-small text-muted">{copy.arrives(p.dateRange)}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
