'use client'

import { formatPaymentAdjustment } from '@commerce/core/adjustment-math'
import OptionCard from '@/components/checkout/option-card'
import { checkoutContent as content } from '@/data/checkout'
import { methodView } from '@/lib/checkout-preview'
import type { CheckoutMethod } from '@/lib/payments'

type PaymentMethodsProps = {
  /** Already in checkout order: UPI first, cash on delivery last. */
  methods: CheckoutMethod[]
  selected: string
  codBlocked: boolean
  /** Why cash on delivery is off for this order, when it is. */
  codNote: string | null
  onSelect: (id: string) => void
}

/** The ways to pay, as cards. A fee or a discount for a method sits on its right. */
export default function PaymentMethods({
  methods,
  selected,
  codBlocked,
  codNote,
  onSelect,
}: PaymentMethodsProps) {
  return (
    <fieldset className="flex flex-col gap-2.5 border-0! p-0!">
      <legend className="sr-only">{content.payment}</legend>
      {methods.map((m) => {
        const view = methodView(m)
        const blocked = m.id === 'cod' && codBlocked
        const adjustment =
          m.adjustment && m.adjustment.value !== 0 ? formatPaymentAdjustment(m.adjustment) : null
        return (
          <OptionCard
            key={m.id}
            name="payment"
            value={m.id}
            checked={selected === m.id}
            disabled={blocked}
            onChange={() => onSelect(m.id)}
            icon={view.icon}
            title={view.title}
            description={view.hint}
            note={blocked ? codNote : null}
            meta={adjustment}
          />
        )
      })}
    </fieldset>
  )
}
