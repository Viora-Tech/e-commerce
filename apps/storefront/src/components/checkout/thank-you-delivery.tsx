import CheckoutIcon from '@/components/checkout/checkout-icon'
import OrderProgress from '@/components/checkout/order-progress'
import { CK_CARD, CK_HEADING } from '@/lib/checkout-classes'

type ThankYouDeliveryProps = {
  heading: string
  body: string
  /** The address on one line. */
  address: string
  /** Index of the step the order reached; below zero while it waits on its payment. */
  reached: number
}

/** Where the order is going and how far along it is. */
export default function ThankYouDelivery({
  heading,
  body,
  address,
  reached,
}: ThankYouDeliveryProps) {
  return (
    <section className={`${CK_CARD} flex flex-col gap-4 p-5`}>
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ck-soft text-ck-ink">
          <CheckoutIcon name="truck" className="size-[1.375rem]" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className={`${CK_HEADING} text-[1.0625rem]! leading-[1.5625rem]!`}>{heading}</h2>
          <p className="text-[0.875rem] leading-5 text-pretty text-ck-muted">{body}</p>
        </div>
      </div>
      <span className="h-px bg-ck-line" />
      <p className="flex items-start gap-2.5 text-[0.875rem] leading-5 text-ck-muted">
        <CheckoutIcon name="pin" className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 [overflow-wrap:anywhere]">{address}</span>
      </p>
      <OrderProgress reached={reached} />
    </section>
  )
}
