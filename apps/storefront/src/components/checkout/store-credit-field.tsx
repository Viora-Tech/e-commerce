'use client'

import { useFormatPaise } from '@commerce/blocks'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { storeCreditCheckoutContent } from '@/data/store-credit'

type StoreCreditFieldProps = {
  /** The signed-in shopper's balance. */
  balancePaise: number
  /** What it pays on this order now, worked out by `checkoutTotals`; 0 while it is off. */
  appliedPaise: number
  on: boolean
  onChange: (on: boolean) => void
}

/**
 * The signed-in shopper's store credit in the checkout summary: "You have ₹X in store credit"
 * with a switch, on by default. The amount it pays shows as its own row under the total; the
 * server takes the balance again when the order is placed, never more than it holds.
 */
export default function StoreCreditField({
  balancePaise,
  appliedPaise,
  on,
  onChange,
}: StoreCreditFieldProps) {
  // Hooks
  const money = useFormatPaise()

  // Render logic
  const words = storeCreditCheckoutContent

  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1 text-[0.875rem]">
      <span className="flex min-w-0 items-start gap-2.5">
        <CheckoutIcon name="cash" className="mt-0.5 size-4 shrink-0 text-ck-summary-muted" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span>{words.have(money(balancePaise))}</span>
          {on && appliedPaise > 0 ? (
            <span className="text-[0.8125rem] text-ck-summary-muted">
              {words.applied(money(appliedPaise))}
            </span>
          ) : null}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-label={words.use}
        aria-checked={on}
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="flex h-6 w-10 shrink-0 items-center rounded-full bg-ck-soft p-0.5 inset-ring inset-ring-ck-line-strong transition-colors duration-150 ease-out peer-checked:bg-ck-button peer-checked:inset-ring-transparent peer-focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] peer-checked:[&>span]:translate-x-4 peer-checked:[&>span]:bg-ck-button-ink motion-reduce:transition-none"
      >
        <span className="size-5 rounded-full bg-ck-muted transition-[translate,background-color] duration-150 ease-out motion-reduce:transition-none" />
      </span>
    </label>
  )
}
