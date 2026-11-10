'use client'

import { deliveryOptionsContent as appCopy } from '@/data/delivery-options'
import { CK_UNPICKED } from '@/lib/checkout-classes'

type InsuranceToggleProps = {
  on: boolean
  /** What insurance adds ("₹25"); null when the route's rate is not filled in. */
  price: string | null
  onChange: (on: boolean) => void
}

/**
 * "Insure this parcel" under the delivery cards (Figma 945:519): a card with a switch, the
 * price beside it. Starts off; the shopper turns it on. What it adds shows in the summary's
 * Delivery line, because the option's price already includes it.
 */
export default function InsuranceToggle({ on, price, onChange }: InsuranceToggleProps) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-ck border px-4 py-3.5 ${CK_UNPICKED}`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[0.9375rem] leading-[1.375rem] font-semibold text-ck-ink">
          {appCopy.insureTitle}
        </span>
        <span className="text-[0.75rem] leading-snug text-ck-muted">{appCopy.insureBody}</span>
      </span>
      {price ? (
        <span className="shrink-0 text-[0.875rem] font-semibold tabular-nums text-ck-ink">
          + {price}
        </span>
      ) : null}
      <input
        type="checkbox"
        role="switch"
        aria-checked={on}
        aria-label={appCopy.insureTitle}
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`relative h-[1.375rem] w-10 shrink-0 rounded-full transition-colors duration-150 peer-focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] motion-reduce:transition-none ${on ? 'bg-ck-accent' : 'bg-ck-line-strong'}`}
      >
        <span
          className={`absolute top-0.5 size-[1.125rem] rounded-full bg-white transition-[left] duration-150 motion-reduce:transition-none ${on ? 'left-5' : 'left-0.5'}`}
        />
      </span>
    </label>
  )
}
