import type { ReactNode } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { CK_INPUT, CK_INPUT_HEIGHT, CK_LABEL } from '@/lib/checkout-classes'

type CheckoutFieldProps = {
  id: string
  label: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  /** Shown under the field, in red, once the shopper has left it or tried to pay. */
  error?: string | null | undefined
  /** A quiet line under the field when there is no error. */
  hint?: ReactNode
  /** Text inside the box before the value, e.g. "+91". */
  prefix?: string
  /** Something inside the box after the value, e.g. a spinner while a PIN code is looked up. */
  trailing?: ReactNode
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  required?: boolean
  autoComplete?: string
  placeholder?: string
  maxLength?: number
  readOnly?: boolean
  /** A control that replaces the plain input (the phone picker); it gets the field id and describes itself with the note. */
  control?: ReactNode
}

/**
 * Label, input and the line under it. The error is tied to the input with
 * aria-describedby and aria-invalid, so a screen reader reads it with the field.
 */
export default function CheckoutField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  prefix,
  trailing,
  type = 'text',
  inputMode,
  required,
  autoComplete,
  placeholder,
  maxLength,
  readOnly,
  control,
}: CheckoutFieldProps) {
  // Render logic
  const note = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={CK_LABEL}>
        {label}
      </label>
      <div className="relative">
        {control ?? null}
        {control ? null : prefix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-ck-line pr-3 pl-3.5 text-[1rem] text-ck-muted"
          >
            {prefix}
          </span>
        ) : null}
        {control ? null : (
          <input
            id={id}
            name={id}
            className={`${CK_INPUT} ${CK_INPUT_HEIGHT} ${prefix ? 'pl-[4.25rem]!' : ''} ${trailing ? 'pr-10!' : ''}`}
            type={type}
            inputMode={inputMode}
            required={required}
            aria-required={required || undefined}
            autoComplete={autoComplete}
            placeholder={placeholder}
            maxLength={maxLength}
            value={value ?? ''}
            onChange={onChange}
            onBlur={onBlur}
            readOnly={readOnly}
            aria-invalid={error ? true : undefined}
            aria-describedby={note}
          />
        )}
        {trailing ? (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-ck-muted">
            {trailing}
          </span>
        ) : null}
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-start gap-1.5 text-[0.8125rem] leading-snug text-ck-danger"
        >
          <CheckoutIcon name="alert" className="mt-px! size-3.5" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[0.8125rem] leading-snug text-ck-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
