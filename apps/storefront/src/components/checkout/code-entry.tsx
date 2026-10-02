'use client'

import { type ReactNode, useId, useState } from 'react'
import CheckoutIcon, { type CheckoutIconName } from '@/components/checkout/checkout-icon'
import { CK_INPUT } from '@/lib/checkout-classes'

type CodeEntryProps = {
  icon: CheckoutIconName
  /** "Add discount code": the closed state, a quiet text button. */
  openLabel: string
  inputLabel: string
  placeholder: string
  applyLabel: string
  code: string
  pending: boolean
  error: string | null
  /** Applied codes, drawn above the entry. */
  chips?: ReactNode
  /** Hide the entry (a code is already applied and only one is allowed). */
  hideEntry?: boolean
  onCode: (code: string) => void
  onApply: () => void
}

/**
 * Code entry in the summary column (discount codes, gift cards). Closed it is one line,
 * so the summary stays calm; open it is a field and an Apply button. No <form> of its own:
 * the page's checkout form must stay the only form (hydration fix #224). Enter applies.
 */
export default function CodeEntry({
  icon,
  openLabel,
  inputLabel,
  placeholder,
  applyLabel,
  code,
  pending,
  error,
  chips = null,
  hideEntry = false,
  onCode,
  onApply,
}: CodeEntryProps) {
  // Hooks
  const id = useId()
  const [open, setOpen] = useState(false)

  // Event handlers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter applies the code instead of submitting the whole checkout.
    if (e.key !== 'Enter') return
    e.preventDefault()
    onApply()
  }

  // Render logic
  const showField = open || code !== '' || error !== null

  return (
    <div className="flex flex-col gap-2.5">
      {chips}
      {hideEntry ? null : showField ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="sr-only">
            {inputLabel}
          </label>
          <div className="flex gap-2">
            <input
              id={id}
              className={`${CK_INPUT} h-11 uppercase placeholder:normal-case`}
              value={code}
              onChange={(e) => onCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={pending}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              // biome-ignore lint/a11y/noAutofocus: opened by the shopper's own tap on "Add code".
              autoFocus={open}
            />
            <button
              type="button"
              onClick={onApply}
              disabled={pending || !code.trim()}
              className="inline-flex h-11 shrink-0 items-center rounded-ck-button! border! border-ck-summary-line! bg-ck-summary-line! px-4 text-[0.875rem]! font-semibold! text-ck-summary-ink! outline-none transition-opacity duration-150 focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              {pending ? (
                <CheckoutIcon
                  name="spinner"
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
              ) : (
                applyLabel
              )}
            </button>
          </div>
          {error ? (
            <p
              id={`${id}-error`}
              role="alert"
              className="flex items-center gap-1.5 text-[0.8125rem] text-ck-danger"
            >
              <CheckoutIcon name="alert" className="size-3.5" />
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex w-fit items-center gap-2 rounded-sm bg-transparent! p-0! text-[0.875rem]! font-medium! text-ck-summary-ink! opacity-80 outline-none transition-opacity duration-150 hover:opacity-100 focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] motion-reduce:transition-none"
        >
          <CheckoutIcon name={icon} className="size-4" />
          <span className="underline decoration-ck-summary-line underline-offset-4">
            {openLabel}
          </span>
        </button>
      )}
    </div>
  )
}
