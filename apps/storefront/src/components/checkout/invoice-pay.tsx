'use client'

import { useActionState } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { invoiceContent as content } from '@/data/checkout'
import { CK_BUTTON_PRIMARY } from '@/lib/checkout-classes'
import { type PayInvoiceResult, payInvoiceAction } from '@/lib/invoice-actions'

type InvoicePayProps = {
  token: string
  /** "₹12,400", on the button. */
  totalLabel: string
}

/** The invoice page's one button: turns the invoice into an order and opens the gateway. */
export default function InvoicePay({ token, totalLabel }: InvoicePayProps) {
  // Hooks
  const [state, action, pending] = useActionState<PayInvoiceResult, FormData>(
    () => payInvoiceAction(token),
    undefined,
  )

  // Render logic
  return (
    <form action={action} className="flex flex-col gap-3">
      <button type="submit" className={CK_BUTTON_PRIMARY} disabled={pending}>
        {pending ? (
          <CheckoutIcon name="spinner" className="size-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <CheckoutIcon name="lock" className="size-4" />
        )}
        {pending ? content.paying : content.pay(totalLabel)}
      </button>
      {state?.error ? (
        <p role="alert" className="text-[0.9375rem] text-ck-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
