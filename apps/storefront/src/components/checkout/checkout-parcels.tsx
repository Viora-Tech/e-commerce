import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content } from '@/data/checkout'
import type { ShopperParcel } from '@/lib/parcels'

type CheckoutParcelsProps = {
  parcels: ShopperParcel[]
}

/**
 * "Ships in 2 parcels": shown when the order will leave from more than one warehouse, with
 * what each parcel holds, where it comes from and when it should arrive.
 */
export default function CheckoutParcels({ parcels }: CheckoutParcelsProps) {
  // Early returns
  if (parcels.length < 2) return null

  return (
    <section
      aria-label={content.parcels.title(parcels.length)}
      className="flex flex-col gap-3 rounded-ck border border-ck-line bg-ck-soft p-4"
    >
      <header className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ck-ink">
          <CheckoutIcon name="truck" className="size-4" />
          {content.parcels.title(parcels.length)}
        </h3>
        <p className="text-[0.8125rem] text-ck-muted">{content.parcels.note}</p>
      </header>
      <ol className="flex flex-col gap-3">
        {parcels.map((p, i) => (
          <li key={p.key} className="flex flex-col gap-1 border-t border-ck-line pt-3">
            <p className="text-[0.875rem] text-ck-ink">
              <span className="font-semibold">{content.parcels.parcel(i + 1)}</span>{' '}
              <span className="text-ck-muted">{content.parcels.from(p.from)}</span>
            </p>
            <ul className="flex flex-col gap-0.5 text-[0.875rem] text-ck-ink">
              {p.items.map((item) => (
                <li key={item.title} className="truncate">
                  {content.parcels.item(item.quantity, item.title)}
                </li>
              ))}
            </ul>
            {p.onHold ? (
              <p className="text-[0.8125rem] text-ck-muted">{content.parcels.onHold}</p>
            ) : p.dateRange ? (
              <p className="text-[0.8125rem] text-ck-muted">
                {content.parcels.arrives(p.dateRange)}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
