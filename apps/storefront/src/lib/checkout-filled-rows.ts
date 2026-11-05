import { checkoutContent as content } from '@/data/checkout'
import type { CheckoutFormState } from '@/lib/checkout-form-state'

export type FilledRow = { label: string; value: string }

const filled = content.filled

/** India's ten digits read "+91 94168 74123"; abroad the field already holds the whole number. */
function readablePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : phone
}

/** The Contact card as rows; no email row when the store leaves it optional and it is empty. */
export function contactRows(form: CheckoutFormState): FilledRow[] {
  const rows = [{ label: filled.mobile, value: readablePhone(form.phone) }]
  return form.email ? [...rows, { label: filled.email, value: form.email }] : rows
}

/** The Delivery card as one row: who it goes to and where. */
export function addressRows(form: CheckoutFormState): FilledRow[] {
  const name = [form.name, form.lastName].filter(Boolean).join(' ')
  const place = [form.city, form.pincode].filter(Boolean).join(' ')
  const value = [name, form.line1, form.line2, place].filter(Boolean).join(', ')
  return [{ label: filled.shipTo, value }]
}
