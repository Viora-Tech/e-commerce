import CheckoutIcon from '@/components/checkout/checkout-icon'
import CourierList from '@/components/checkout/courier-list'
import { checkoutContent as content } from '@/data/checkout'
import { deliveryOptionsContent as appCopy } from '@/data/delivery-options'
import { deliveryCardLine } from '@/lib/delivery-card-line'
import type { DeliveryParcelCards } from '@/lib/delivery-options'
import type { ShopperParcel } from '@/lib/parcels'

type ParcelCourierListsProps = {
  optionId: string
  /** Each parcel's own couriers, in parcel order. */
  parcels: DeliveryParcelCards[]
  /** What each parcel holds, by its key (`CheckoutShipping.parcels`). */
  contents: ShopperParcel[]
  /** The courier picked per parcel; null or missing: the parcel's first (its own pick). */
  selected: ReadonlyArray<string | null>
  onPick: (index: number, routeKey: string) => void
  price: (paise: number) => string
  money: (paise: number) => string
}

/**
 * "Ships in 2 parcels" for a cart whose products' rules share no courier (owner, 21 Nov 2026):
 * each parcel with what is in it and its own courier list, so the shopper picks a courier per
 * parcel. The summary's Shipping line adds the picks up.
 */
export default function ParcelCourierLists({
  optionId,
  parcels,
  contents,
  selected,
  onPick,
  price,
  money,
}: ParcelCourierListsProps) {
  return (
    <section
      aria-label={content.parcels.title(parcels.length)}
      className="flex flex-col gap-3 rounded-ck border border-ck-line bg-ck-field p-4"
    >
      <header className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ck-ink">
          <CheckoutIcon name="truck" className="size-4" />
          {content.parcels.title(parcels.length)}
        </h3>
        <p className="text-[0.8125rem] text-ck-muted">{appCopy.splitNote}</p>
      </header>
      <ol className="flex flex-col gap-3">
        {parcels.map((p, i) => {
          const items = contents.find((c) => c.key === p.key)?.items ?? []
          return (
            <li key={p.key} className="flex flex-col gap-2 border-t border-ck-line pt-3">
              <p className="text-[0.875rem] font-semibold text-ck-ink">
                {content.parcels.parcel(i + 1)}
              </p>
              {items.length ? (
                <ul className="flex flex-col gap-0.5 text-[0.875rem] text-ck-ink">
                  {items.map((item) => (
                    <li key={item.title} className="truncate">
                      {content.parcels.item(item.quantity, item.title)}
                    </li>
                  ))}
                </ul>
              ) : null}
              <CourierList
                optionId={optionId}
                group={`shipping-rate-${i + 1}`}
                choices={p.choices}
                selected={selected[i] ?? p.choices[0]?.routeKey ?? null}
                onPick={(key) => onPick(i, key)}
                price={price}
                money={money}
                preferred={p.preferred}
                fullPrices={p.fullPrices}
                heading={null}
                note={(j) =>
                  deliveryCardLine({
                    title: p.choices[j]?.label ?? '',
                    mode: p.choices[j]?.mode ?? null,
                    codAllowed: null,
                    codOffered: false,
                    minutesLeft: null,
                  })
                }
              />
            </li>
          )
        })}
      </ol>
    </section>
  )
}
