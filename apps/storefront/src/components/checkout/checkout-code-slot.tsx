'use client'

import { OTPInputContext } from 'input-otp'
import { useContext } from 'react'

type CheckoutCodeSlotProps = { index: number }

/** One box of the code field, the shadcn input-otp slot in the checkout's own tokens. */
export default function CheckoutCodeSlot({ index }: CheckoutCodeSlotProps) {
  // Hooks
  const { slots } = useContext(OTPInputContext)

  // Render logic
  const slot = slots[index]

  return (
    <div
      className={`relative grid size-13 place-items-center rounded-ck border bg-ck-field text-[1.125rem] font-semibold text-ck-ink tabular-nums transition-[border-color,box-shadow] duration-150 ease-out motion-reduce:transition-none ${slot?.isActive ? 'border-ck-accent-lift [box-shadow:0_0_0_1px_var(--ck-accent-lift)]' : 'border-ck-line'}`}
    >
      {slot?.char}
      {slot?.hasFakeCaret ? (
        <span
          aria-hidden="true"
          className="h-5 w-px animate-pulse bg-ck-ink motion-reduce:animate-none"
        />
      ) : null}
    </div>
  )
}
