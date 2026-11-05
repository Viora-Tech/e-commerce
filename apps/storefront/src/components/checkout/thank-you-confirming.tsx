import CheckoutIcon from '@/components/checkout/checkout-icon'
import ThankYouRefresh from '@/components/checkout/thank-you-refresh'
import ThankYouRows from '@/components/checkout/thank-you-rows'
import { thankYouContent } from '@/data/checkout'
import { CK_CARD, CK_HEADING } from '@/lib/checkout-classes'

type ThankYouConfirmingProps = {
  rows: readonly (readonly [string, string])[]
}

const content = thankYouContent.confirming

/** The moment after paying, while the gateway has not answered: stay here, it is on its way. */
export default function ThankYouConfirming({ rows }: ThankYouConfirmingProps) {
  return (
    <>
      <ThankYouRefresh />
      <section className={`${CK_CARD} flex flex-col gap-4 px-5 py-10 sm:px-10 sm:py-14`}>
        <div className="flex items-center gap-3.5">
          <CheckoutIcon
            name="spinner"
            className="size-11 shrink-0 animate-spin text-ck-accent-lift motion-reduce:animate-none"
          />
          <h1 className={`${CK_HEADING} text-[1.375rem]! font-bold! sm:text-[1.875rem]!`}>
            {content.heading}
          </h1>
        </div>
        <p className="text-[0.9375rem] leading-[1.375rem] text-pretty text-ck-muted">
          {content.body}
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <span className="h-px bg-ck-line" />
          <ThankYouRows rows={rows} />
        </div>
      </section>
      <p className="flex items-start gap-2.5 p-1 text-[0.875rem] leading-5 text-ck-muted">
        <CheckoutIcon name="shield" className="mt-px size-[1.125rem] shrink-0" />
        {content.reassurance}
      </p>
    </>
  )
}
