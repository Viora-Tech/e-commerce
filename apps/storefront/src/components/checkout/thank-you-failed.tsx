import type { ReactNode } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import ThankYouRows from '@/components/checkout/thank-you-rows'
import { thankYouContent } from '@/data/checkout'
import { CK_CARD } from '@/lib/checkout-classes'

type ThankYouFailedProps = {
  rows: readonly (readonly [string, string])[]
  /** The shopper's way forward: a new attempt, a new QR. */
  actions: ReactNode
  /** The store's WhatsApp link, when it has a number. */
  help: string | null
}

const content = thankYouContent.failed

/** A payment that did not go through: what was tried, that the money is safe, what to do next. */
export default function ThankYouFailed({ rows, actions, help }: ThankYouFailedProps) {
  return (
    <>
      <div className={`${CK_CARD} px-[1.125rem] py-4`}>
        <ThankYouRows rows={rows} />
      </div>
      <div className="flex items-start gap-3 rounded-[calc(var(--ck-radius)*1.6)] bg-ck-success-soft px-[1.125rem] py-4">
        <CheckoutIcon name="shield" className="size-[1.375rem] shrink-0 text-ck-success" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[0.9375rem] leading-[1.375rem] font-semibold text-ck-success">
            {content.safeHeading}
          </p>
          <p className="text-[0.875rem] leading-5 text-pretty text-ck-muted">{content.safeBody}</p>
        </div>
      </div>
      {actions}
      {help ? (
        <a
          href={help}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-1.5 text-[0.875rem] leading-5 font-semibold text-ck-ink! no-underline outline-none hover:underline focus-visible:underline"
        >
          <CheckoutIcon name="whatsapp" className="size-4 text-ck-success" />
          {content.help}
        </a>
      ) : null}
    </>
  )
}
