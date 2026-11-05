'use client'

import { useState } from 'react'
import PaymentMark from '@/components/checkout/payment-mark'
import { checkoutContent } from '@/data/checkout'
import { CK_HEADING, CK_LIFT } from '@/lib/checkout-classes'
import { rememberPickedMethod } from '@/lib/razorpay-picked-method'

type PaymentMethodTabsProps = {
  /** What the gateway takes here, in tab order. */
  tabs: readonly string[]
  /** The gateway's brand, named in the line under the panel. */
  brand: string
}

const content = checkoutContent.methodPanel

/**
 * The picked gateway's ways to pay as tabs. Nothing is entered here: the shopper chooses, and
 * Pay opens the gateway's own secure window on that method. Card numbers never touch our page.
 */
export default function PaymentMethodTabs({ tabs, brand }: PaymentMethodTabsProps) {
  // Hooks
  const [picked, setPicked] = useState(tabs[0] ?? 'upi')

  // Event handlers
  const handlePick = (method: string) => {
    setPicked(method)
    rememberPickedMethod(method)
  }

  // Render logic
  const hint = content.tabHints[picked]

  return (
    <div className="flex flex-col gap-4 px-4 pt-1 pb-5">
      <div className="grid auto-cols-fr grid-flow-col gap-2">
        {tabs.map((method) => (
          <button
            key={method}
            type="button"
            aria-pressed={method === picked}
            onClick={() => handlePick(method)}
            className={`h-9 min-w-0 cursor-pointer truncate rounded-ck px-2 text-[0.8125rem]! font-semibold! outline-none transition-colors duration-150 focus-visible:[box-shadow:0_0_0_0.1875rem_var(--ck-ring)] ${method === picked ? 'bg-ck-accent-lift! text-ck-accent-ink!' : 'bg-ck-soft! text-ck-muted! hover:text-ck-ink!'}`}
          >
            {content.tabNames[method] ?? method}
          </button>
        ))}
      </div>
      {picked === 'upi' ? (
        <div key={picked} className={`flex flex-col gap-3 ${CK_LIFT}`}>
          <h3 className={`${CK_HEADING} text-[1rem]! leading-[1.4375rem]!`}>
            {content.upiHeading}
          </h3>
          <p className="text-[0.875rem] leading-5 text-ck-muted">{content.upiBody}</p>
          <span aria-hidden="true" className="flex items-center gap-1.5">
            {content.upiApps.map((mark) => (
              <PaymentMark key={mark} mark={mark} />
            ))}
          </span>
        </div>
      ) : (
        <p key={picked} className={`text-[0.875rem] leading-5 text-ck-muted ${CK_LIFT}`}>
          {hint}
        </p>
      )}
      <p className="text-[0.75rem] leading-[1.0625rem] text-ck-faint">
        {content.processedBy(brand)}
      </p>
    </div>
  )
}
