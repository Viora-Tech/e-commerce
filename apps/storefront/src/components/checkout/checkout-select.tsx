import CheckoutIcon from '@/components/checkout/checkout-icon'
import { CK_INPUT, CK_INPUT_HEIGHT, CK_LABEL } from '@/lib/checkout-classes'

type CheckoutSelectProps = {
  id: string
  label: string
  value: string
  options: readonly (readonly [string, string])[]
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string | null | undefined
  autoComplete?: string
}

/** A native select in the checkout's field look: the phone's own picker, keyboard-friendly. */
export default function CheckoutSelect({
  id,
  label,
  value,
  options,
  onChange,
  onBlur,
  error,
  autoComplete,
}: CheckoutSelectProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={CK_LABEL}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          name={id}
          className={`${CK_INPUT} ${CK_INPUT_HEIGHT} cursor-pointer appearance-none truncate pr-10!`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        >
          {options.map(([v, text]) => (
            <option key={v} value={v}>
              {text}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-ck-muted">
          <CheckoutIcon name="chevron" className="size-4" />
        </span>
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-start gap-1.5 text-[0.8125rem] leading-snug text-ck-danger"
        >
          <CheckoutIcon name="alert" className="mt-px! size-3.5" />
          {error}
        </p>
      ) : null}
    </div>
  )
}
