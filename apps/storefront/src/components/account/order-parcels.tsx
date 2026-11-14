import { accountContent } from '@/data/account'
import { ACCOUNT_CARD, ACCOUNT_CARD_TITLE } from '@/lib/account-classes'
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
    <section className={ACCOUNT_CARD} aria-labelledby="order-parcels">
      <header className="flex flex-col gap-1">
        <h2 id="order-parcels" className={ACCOUNT_CARD_TITLE}>
          {copy.title(parcels.length)}
        </h2>
        <p className="text-[0.8125rem] text-ck-muted">{copy.note}</p>
      </header>
      <ol className="flex flex-col divide-y divide-ck-line">
        {parcels.map((p, i) => (
          <li key={p.key} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <p className="text-[0.9375rem]">
              <span className="font-semibold">{copy.parcel(i + 1)}</span>{' '}
              <span className="text-ck-muted">{copy.from(p.from)}</span>
            </p>
            <ul className="flex flex-col gap-0.5 text-[0.9375rem]">
              {p.items.map((item) => (
                <li key={item.title}>{copy.item(item.quantity, item.title)}</li>
              ))}
            </ul>
            {p.onHold ? (
              <p className="text-[0.8125rem] text-ck-muted">{copy.onHold}</p>
            ) : p.dateRange ? (
              <p className="text-[0.8125rem] text-ck-muted">{copy.arrives(p.dateRange)}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
