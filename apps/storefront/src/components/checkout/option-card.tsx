import type { ReactNode } from 'react'
import CheckoutIcon, { type CheckoutIconName } from '@/components/checkout/checkout-icon'
import RadioDot from '@/components/checkout/radio-dot'
import { CK_PICKED, CK_UNPICKED } from '@/lib/checkout-classes'

type OptionCardProps = {
  name: string
  value: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
  title: ReactNode
  /** The round mark beside the name. */
  icon?: CheckoutIconName | undefined
  description?: ReactNode
  /** Right-hand side: a price, a fee, "Free". */
  meta?: ReactNode
  /** A line under the description, e.g. why cash on delivery is not available. */
  note?: ReactNode
}

/**
 * One radio choice drawn as a card (design: the Shipping options): the dot, the name with
 * its date under it, the price on the right. The whole card is the label, arrow keys move
 * between cards like any radio group, and the picked one wears the accent ring; the ring
 * and the fill move in 150ms ease-out.
 */
export default function OptionCard({
  name,
  value,
  checked,
  disabled = false,
  onChange,
  title,
  icon,
  description = null,
  meta = null,
  note = null,
}: OptionCardProps) {
  return (
    <label
      className={`relative flex items-start gap-3.5 rounded-ck border p-[1.125rem] transition-[border-color,background-color,box-shadow] duration-150 ease-out motion-reduce:transition-none has-[:focus-visible]:[box-shadow:0_0_0_3px_var(--ck-ring),0_0_0_1px_var(--ck-accent)] sm:gap-3 sm:px-4 sm:py-3.5 ${checked ? CK_PICKED : CK_UNPICKED} ${disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="peer sr-only"
      />
      <span className="pt-0.5">
        <RadioDot checked={checked} />
      </span>
      {icon ? (
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-full text-ck-ink ${checked ? 'bg-ck-bg' : 'bg-ck-soft'}`}
        >
          <CheckoutIcon name={icon} className="size-5" />
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[1rem] leading-[1.4375rem] font-semibold text-ck-ink">{title}</span>
        {description ? (
          <span
            className={`text-[0.875rem] leading-5 font-medium ${checked ? 'text-ck-success' : 'text-ck-ink'}`}
          >
            {description}
          </span>
        ) : null}
        {note ? <span className="text-[0.75rem] leading-snug text-ck-danger">{note}</span> : null}
      </span>
      {meta ? (
        <span className="shrink-0 text-right text-[0.9375rem] leading-[1.375rem] font-semibold tabular-nums text-ck-ink">
          {meta}
        </span>
      ) : null}
    </label>
  )
}
