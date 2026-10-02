import type { ReactNode } from 'react'
import CheckoutIcon, { type CheckoutIconName } from '@/components/checkout/checkout-icon'

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
  icon?: CheckoutIconName
  /** A line under the description, e.g. why cash on delivery is not available. */
  note?: ReactNode
}

/**
 * One radio choice drawn as a card: the whole card is the label, arrow keys move between
 * cards like any radio group, and the picked one wears the accent colour.
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
  icon,
  note = null,
}: OptionCardProps) {
  return (
    <label
      className={`group relative flex min-h-16 items-center gap-3.5 rounded-ck border bg-ck-field px-4 py-3.5 transition-[border-color,background-color,box-shadow] duration-150 motion-reduce:transition-none has-[:focus-visible]:[box-shadow:0_0_0_3px_var(--ck-ring),inset_0_0_0_1px_var(--ck-accent)] ${
        checked
          ? 'border-ck-accent bg-ck-accent-soft [box-shadow:inset_0_0_0_1px_var(--ck-accent)]'
          : 'border-ck-line hover:border-ck-muted/50'
      } ${disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`}
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
      <span
        aria-hidden="true"
        className={`flex size-[1.125rem] shrink-0 items-center justify-center rounded-full border transition-colors duration-150 motion-reduce:transition-none ${
          checked ? 'border-ck-accent bg-ck-accent' : 'border-ck-muted/60 bg-ck-field'
        }`}
      >
        <span
          className={`size-1.5 rounded-full bg-ck-accent-ink ${checked ? 'opacity-100' : 'opacity-0'}`}
        />
      </span>
      {icon ? (
        <span
          aria-hidden="true"
          className={`flex size-9 shrink-0 items-center justify-center rounded-ck border border-ck-line bg-ck-bg ${checked ? 'text-ck-accent' : 'text-ck-muted'}`}
        >
          <CheckoutIcon name={icon} className="size-[1.125rem]" />
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[0.9375rem] leading-snug font-medium text-ck-ink">{title}</span>
        {description ? (
          <span className="text-[0.8125rem] leading-snug text-ck-muted">{description}</span>
        ) : null}
        {note ? <span className="text-[0.8125rem] leading-snug text-ck-danger">{note}</span> : null}
      </span>
      {meta ? (
        <span className="shrink-0 text-right text-[0.875rem] font-medium tabular-nums text-ck-ink">
          {meta}
        </span>
      ) : null}
    </label>
  )
}
