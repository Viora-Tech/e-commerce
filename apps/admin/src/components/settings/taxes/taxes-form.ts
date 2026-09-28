import { TaxesFormSchema } from '@commerce/core/tax-settings'
import { nextNumberProblem, SeriesSchema } from '@commerce/invoices'
import type { api } from '@/lib/api-client'

export type TaxesView = NonNullable<Awaited<ReturnType<typeof api.taxes.get>>>
/** What the page edits: the saved form plus the numbering fields; sent as is to `taxes.save`. */
export type TaxesFormState = TaxesView['form'] & {
  numbering: Pick<TaxesView['numbering'], 'prefix' | 'resetEachYear' | 'nextNumber'>
}
export type TaxesErrors = Partial<Record<string, string>>

/** The editable part of what the server sent. */
export function formOf(view: TaxesView): TaxesFormState {
  const { prefix, resetEachYear, nextNumber } = view.numbering
  return { ...view.form, numbering: { prefix, resetEachYear, nextNumber } }
}

/** Problems keyed by dotted path (`address.pincode`, `numbering.prefix`), checked before saving. */
export function validateTaxes(form: TaxesFormState, lowest: number): TaxesErrors {
  const errors: TaxesErrors = {}
  const r = TaxesFormSchema.safeParse(form)
  if (!r.success) {
    for (const i of r.error.issues) errors[i.path.join('.')] ??= i.message
  }
  const prefix = SeriesSchema.shape.pattern.safeParse(form.numbering.prefix)
  if (!prefix.success) errors['numbering.prefix'] = prefix.error.issues[0]?.message
  const next = nextNumberProblem(lowest, Number(form.numbering.nextNumber))
  if (next) errors['numbering.nextNumber'] = next
  return errors
}
