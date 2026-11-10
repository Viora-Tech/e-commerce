'use client'

type CodeBoxesProps = {
  value: string
  onChange: (digits: string) => void
  label: string
  disabled?: boolean
}

const LENGTH = 6

/**
 * The six-digit code as six boxes (Figma 948:15578). One real input lies over the boxes, so
 * paste, SMS autofill (`one-time-code`) and screen readers see a single field; the boxes only
 * draw what it holds and where the next digit goes.
 */
export default function CodeBoxes({ value, onChange, label, disabled = false }: CodeBoxesProps) {
  // Render logic
  const digits = value.slice(0, LENGTH).split('')
  const next = Math.min(digits.length, LENGTH - 1)

  return (
    <div className="relative">
      <div aria-hidden="true" className="grid grid-cols-6 gap-2.5">
        {Array.from({ length: LENGTH }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed six slots.
            key={i}
            className={`grid h-14 place-items-center rounded-xl border text-[1.375rem] font-semibold tabular-nums transition-colors ${
              i === next && !disabled
                ? 'border-[var(--color-ink)] ring-2 ring-[color-mix(in_oklab,var(--color-ink)_18%,transparent)]'
                : 'border-[color-mix(in_oklab,var(--color-ink)_18%,transparent)]'
            }`}
          >
            {digits[i] ?? ''}
          </span>
        ))}
      </div>
      <input
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={LENGTH}
        required
        disabled={disabled}
        // biome-ignore lint/a11y/noAutofocus: the only field on this step, reached by the shopper's own submit.
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, LENGTH))}
      />
    </div>
  )
}
