'use client'

import { OTPInput, REGEXP_ONLY_DIGITS } from 'input-otp'
import CheckoutCodeSlot from '@/components/checkout/checkout-code-slot'
import { CK_LABEL } from '@/lib/checkout-classes'

type CodeBoxesProps = {
  id: string
  value: string
  onChange: (digits: string) => void
  /** The sixth digit is in (typed, pasted or filled from the SMS): the form sends it. */
  onComplete?: () => void
  label: string
  disabled?: boolean
  /** Id of the error line, when the code was refused. */
  errorId?: string | null
}

const SLOTS = [0, 1, 2, 3, 4, 5]

/**
 * The six-digit code as six boxes (Figma 948:15578), the checkout's own code field: input-otp
 * keeps one real input under the boxes, so paste, SMS autofill (`one-time-code`) and screen
 * readers see a single field. Refused, every box takes the danger edge.
 */
export default function CodeBoxes({
  id,
  value,
  onChange,
  onComplete,
  label,
  disabled = false,
  errorId = null,
}: CodeBoxesProps) {
  // Render logic
  const invalid = errorId !== null

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={`${CK_LABEL} sr-only`}>
        {label}
      </label>
      <OTPInput
        id={id}
        name="code"
        maxLength={6}
        pattern={REGEXP_ONLY_DIGITS}
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        disabled={disabled}
        autoFocus
        value={value}
        onChange={onChange}
        {...(onComplete ? { onComplete } : {})}
        containerClassName="grid grid-cols-6 gap-2 sm:gap-2.5"
        aria-invalid={invalid ? true : undefined}
        aria-describedby={errorId ?? undefined}
      >
        {SLOTS.map((index) => (
          <CheckoutCodeSlot key={index} index={index} invalid={invalid} fluid />
        ))}
      </OTPInput>
    </div>
  )
}
