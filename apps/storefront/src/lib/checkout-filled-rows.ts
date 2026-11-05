import { checkoutContent as content } from '@/data/checkout'
import type { CheckoutFormState } from '@/lib/checkout-form-state'
import type { CheckoutSection } from '@/lib/checkout-sections'

/** One finished step, as the review above the current step shows it. */
export type ReviewRow = { section: CheckoutSection; label: string; value: string }

const review = content.review

/** India's ten digits read "+91 94168 74123"; abroad the field already holds the whole number. */
function readablePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '')
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : phone
}

/** Who the order goes to and where, on one line. */
function addressLine(form: CheckoutFormState): string {
  const name = [form.name, form.lastName].filter(Boolean).join(' ')
  const place = [form.city, form.pincode].filter(Boolean).join(' ')
  return [name, form.line1, form.line2, place].filter(Boolean).join(', ')
}

/** The rows for the steps before `step`, in step order. */
export function reviewRows(
  sections: readonly CheckoutSection[],
  step: CheckoutSection,
  form: CheckoutFormState,
  shippingLine: string | null,
): ReviewRow[] {
  const values: Record<CheckoutSection, ReviewRow | null> = {
    contact: {
      section: 'contact',
      label: review.contact,
      value: readablePhone(form.phone) || form.email,
    },
    address: { section: 'address', label: review.shipTo, value: addressLine(form) },
    shipping: shippingLine
      ? { section: 'shipping', label: review.delivery, value: shippingLine }
      : null,
    payment: null,
  }
  return sections
    .slice(0, sections.indexOf(step))
    .flatMap((section) => (values[section] ? [values[section]] : []))
}
