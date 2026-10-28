import type { ReactNode } from 'react'
import RadioDot from '@/components/checkout/radio-dot'
import { CK_PICKED, CK_UNPICKED } from '@/lib/checkout-classes'

type OptionCardProps = {
  name: string
  value: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
  title: ReactNode
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
  description = null,
  meta = null,
  note = null,
}: OptionCardProps) {
  return (
    <label
      className={`relative flex items-center gap-2.5 rounded-ck border px-3.5 py-3 transition-[border-color,background-color,box-shadow] duration-150 ease-out motion-reduce:transition-none has-[:focus-visible]:[box-shadow:0_0_0_3px_var(--ck-ring),0_0_0_1px_var(--ck-accent)] sm:gap-3 sm:px-4 sm:py-3.5 ${checked ? CK_PICKED : CK_UNPICKED} ${disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`}
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
      <RadioDot checked={checked} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:gap-1">
        <span className="text-[0.8125rem] leading-snug font-semibold text-ck-ink sm:text-[0.875rem]">
          {title}
        </span>
        {description ? (
          <span className="text-[0.75rem] leading-snug text-ck-muted sm:text-[0.8125rem]">
            {description}
          </span>
        ) : null}
        {note ? <span className="text-[0.75rem] leading-snug text-ck-danger">{note}</span> : null}
      </span>
      {meta ? (
        <span className="shrink-0 text-right text-[0.8125rem] font-semibold tabular-nums text-ck-ink sm:text-[0.875rem]">
          {meta}
        </span>
      ) : null}
    </label>
  )
}
