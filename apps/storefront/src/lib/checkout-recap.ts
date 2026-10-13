import { formatPaise } from '@commerce/blocks'
import { checkoutContent as content } from '@/data/checkout'
import type { CheckoutFormState } from '@/lib/checkout-form-state'
import type { CheckoutStep } from '@/lib/checkout-steps'
import type { CheckoutRate } from '@/lib/shipping'

/*
 * The recap above the current step: one row per finished piece, newest last. Pure, so it is
 * tested on its own.
 */

export type RecapRow = {
  label: string
  value: string
  /** The step that edits this row. */
  step: CheckoutStep
  /** The Change button's full name for a screen reader, e.g. "Change address". */
  changeLabel: string
}

export type RecapInput = {
  step: CheckoutStep
  steps: readonly CheckoutStep[]
  form: Pick<CheckoutFormState, 'name' | 'email' | 'phone' | 'line1' | 'line2' | 'city' | 'pincode'>
  digitalOnly: boolean
  /** The picked rate; null when shipping is free for the whole order. */
  rate: CheckoutRate | null
}

/** "+91 98765 43210" from the stored "+919876543210"; anything else as typed. */
export function displayPhone(phone: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(phone.replace(/\s/g, ''))
  return m ? `+91 ${m[1]} ${m[2]}` : phone
}

const join = (parts: string[], sep: string): string =>
  parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(sep)

function deliveryValue(rate: CheckoutRate | null): string {
  if (!rate) return content.delivery.free
  const price = rate.pricePaise === 0 ? content.shippingFree : formatPaise(rate.pricePaise)
  const dates = rate.dateRange ? content.rateDelivery(rate.dateRange) : ''
  return join([rate.name || content.delivery.standard, price, dates], ' · ')
}

/** The rows for every step before the current one. */
export function recapRows({ step, steps, form, digitalOnly, rate }: RecapInput): RecapRow[] {
  const at = steps.indexOf(step)
  const rows: RecapRow[] = []
  if (at > steps.indexOf('address')) {
    rows.push({
      label: content.recap.contact,
      value: join([form.email, displayPhone(form.phone)], ' · '),
      step: 'address',
      changeLabel: content.recap.changeContact,
    })
    rows.push({
      label: digitalOnly ? content.recap.billTo : content.recap.shipTo,
      value: join([form.name, form.line1, form.line2, join([form.city, form.pincode], ' ')], ', '),
      step: 'address',
      changeLabel: content.recap.changeAddress,
    })
  }
  const shipping = steps.indexOf('shipping')
  if (shipping !== -1 && at > shipping) {
    rows.push({
      label: content.recap.delivery,
      value: deliveryValue(rate),
      step: 'shipping',
      changeLabel: content.recap.changeDelivery,
    })
  }
  return rows
}
