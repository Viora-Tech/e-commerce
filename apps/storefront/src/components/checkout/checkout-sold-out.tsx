'use client'

import type { CartLineView } from '@commerce/core'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent } from '@/data/checkout'
import { notifyMeAction } from '@/lib/back-in-stock-actions'
import { setQuantityAction } from '@/lib/cart-actions'
import { CK_BUTTON_PRIMARY, CK_BUTTON_SECONDARY, CK_CARD, CK_HEADING } from '@/lib/checkout-classes'

type CheckoutSoldOutProps = {
  /** The lines that sold out while the shopper was checking out. */
  lines: CartLineView[]
  /** How many other lines are still fine. */
  others: number
  /** Where "Notify me" sends the alert; nothing to send to hides the button. */
  email: string
  phone: string
}

const content = checkoutContent.soldOut

/**
 * An item ran out during checkout. Nothing is charged: the steps wait here until each sold-out
 * line is removed. "Notify me" signs the shopper up with the contact they already gave, using
 * the store's back-in-stock list.
 */
export default function CheckoutSoldOut({ lines, others, email, phone }: CheckoutSoldOutProps) {
  // Hooks
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [notified, setNotified] = useState<readonly string[]>([])

  // Event handlers
  const handleRemove = (lineId: string) =>
    startTransition(async () => {
      await setQuantityAction(lineId, 0)
      router.refresh()
    })
  const handleNotify = (variantId: string) =>
    startTransition(async () => {
      const form = new FormData()
      if (email) form.set('email', email)
      if (phone) form.set('phone', phone)
      const state = await notifyMeAction(variantId, { status: 'idle' }, form)
      if (state.status === 'done') setNotified((was) => [...was, variantId])
    })

  // Render logic
  const canNotify = email !== '' || phone !== ''

  return (
    <div data-sold-out className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className={`${CK_HEADING} text-[1.875rem]! leading-9! font-bold!`}>
          {content.heading(lines.length)}
        </h2>
        <p className="text-[0.9375rem] leading-[1.375rem] text-ck-muted">{content.body}</p>
      </div>
      {lines.map((line) => (
        <section key={line.id} className={`${CK_CARD} flex flex-col gap-4 p-6`}>
          <div className="flex items-start gap-3.5">
            <span className="relative size-14 shrink-0 rounded-[0.75rem] bg-ck-soft">
              {line.imageUrl ? (
                // biome-ignore lint/performance/noImgElement: same thumbnail as the order summary.
                <img
                  src={line.imageUrl}
                  alt=""
                  className="size-14! rounded-[0.75rem] object-cover"
                />
              ) : null}
              <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-ck-muted text-[0.6875rem] font-semibold text-ck-bg">
                {line.quantity}
              </span>
            </span>
            <div className="flex min-w-0 flex-col items-start gap-1">
              <p className="text-[0.9375rem] leading-[1.375rem] font-semibold text-ck-ink">
                {line.productTitle}
              </p>
              {line.variantTitle && !/^default/i.test(line.variantTitle) ? (
                <p className="text-[0.8125rem] leading-[1.1875rem] text-ck-muted">
                  {line.variantTitle}
                </p>
              ) : null}
              <span className="flex h-6 items-center gap-1 rounded-[0.375rem] bg-ck-danger-soft px-2 text-[0.75rem] font-semibold text-ck-danger">
                <CheckoutIcon name="alert" className="size-[0.8125rem]" />
                {content.chip}
              </span>
            </div>
          </div>
          <span className="h-px bg-ck-line" />
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              disabled={pending}
              onClick={() => handleRemove(line.id)}
              className={`${CK_BUTTON_PRIMARY} min-w-0 flex-1`}
            >
              {content.remove}
            </button>
            {canNotify ? (
              <button
                type="button"
                disabled={pending || notified.includes(line.variantId)}
                onClick={() => handleNotify(line.variantId)}
                className={`${CK_BUTTON_SECONDARY} h-13! min-w-0 flex-1`}
              >
                {notified.includes(line.variantId) ? content.notified : content.notify}
              </button>
            ) : null}
          </div>
        </section>
      ))}
      {others > 0 ? (
        <p className="flex items-start gap-3 rounded-ck bg-ck-accent-soft px-4 py-3.5 text-[0.875rem] leading-5 font-semibold text-ck-ink">
          <CheckoutIcon name="bag" className="size-5 shrink-0" />
          {content.others(others)}
        </p>
      ) : null}
    </div>
  )
}
