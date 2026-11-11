'use client'

import { dayStart } from '@commerce/dates'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import DateField from '@/components/fields/date-field'
import { storeCreditExpiryContent } from '@/data/store-credit-expiry'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { formatPattern, todayKey } from '@/lib/format-date'

type StoreCreditExpiryFieldProps = {
  id: string
  /** `YYYY-MM-DD`, or '' for never. */
  value: string
  onChange: (value: string) => void
  /**
   * Store credit the order was paid with going back: the pre-filled original last day ('' when
   * it never expired), so the hint can say where the date came from.
   */
  originalDay?: string | undefined
}

/** The optional last day store credit given here can be spent; empty never expires. */
export default function StoreCreditExpiryField({
  id,
  value,
  onChange,
  originalDay,
}: StoreCreditExpiryFieldProps) {
  // Hooks
  const copy = useCopy(storeCreditExpiryContent)
  const locale = useLocale()

  // Render logic
  const original = originalDay
    ? formatPattern(
        dayStart(originalDay),
        { day: 'numeric', month: 'short', year: 'numeric' },
        locale,
      )
    : null

  return (
    <Field>
      <FieldLabel htmlFor={id}>{copy.label}</FieldLabel>
      <DateField
        id={id}
        min={todayKey()}
        value={value}
        onChange={onChange}
        placeholder={copy.placeholder}
        clearable
      />
      <FieldDescription>
        {originalDay === undefined ? copy.hint : copy.backHint(original)}
      </FieldDescription>
    </Field>
  )
}
