'use client'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@commerce/ui/shadcn/input-group'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'

type MoneyInputProps = {
  size?: 'default' | 'lg' | 'kit'
  id?: string | undefined
  value: string
  onChange: (value: string) => void
  /** Text shown after the number, e.g. "g" for grams. */
  suffix?: string | undefined
  /** Omit the ₹ prefix (weights, quantities). */
  currency?: boolean
  disabled?: boolean | undefined
  invalid?: boolean | undefined
  placeholder?: string | undefined
  'aria-label'?: string | undefined
  /** Extra classes on the group, e.g. to drop the border inside a composed field. */
  className?: string | undefined
}

/** Numeric input with a ₹ prefix; the value stays a string so typing "12." survives. */
export default function MoneyInput({
  id,
  value,
  onChange,
  suffix,
  currency = true,
  disabled,
  invalid,
  placeholder,
  'aria-label': ariaLabel,
  size = 'default',
  className,
}: MoneyInputProps) {
  // Hooks
  const copy = useCopy(productFormContent)

  return (
    <InputGroup size={size} className={className}>
      {currency ? (
        <InputGroupAddon>
          <InputGroupText aria-label={copy.currency}>₹</InputGroupText>
        </InputGroupAddon>
      ) : null}
      <InputGroupInput
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={invalid}
        aria-label={ariaLabel}
        placeholder={placeholder}
        autoComplete="off"
        // Money is typed, not nudged: hide the browser's number spinner.
        className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix ? (
        <InputGroupAddon align="inline-end">
          <InputGroupText className="whitespace-nowrap">{suffix}</InputGroupText>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}
