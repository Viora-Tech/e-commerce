'use client'

import { formatPaise } from '@commerce/blocks'
import type { CartView, DeliveryEstimate } from '@commerce/core'
import { applyPaymentAdjustment, formatPaymentAdjustment } from '@commerce/core/adjustments'
import { useState, useTransition } from 'react'
import DiscountCodeField from '@/components/cart/discount-code-field'
import CheckoutField from '@/components/checkout/checkout-field'
import { checkoutContent as content, INDIAN_STATES } from '@/data/checkout'
import { captureContactAction, checkoutAction, type CheckoutForm as Form } from '@/lib/cart-actions'
import type { CartDiscountView } from '@/lib/discount-actions'
import type { CheckoutMethod } from '@/lib/payments'
import { estimateDeliveryAction } from '@/lib/shipping-actions'

type CheckoutFormProps = {
  storeId: string
  cart: CartView
  methods: CheckoutMethod[]
  /** Discount in force for this cart, resolved on the server. */
  discount: CartDiscountView | null
}

type ChangeHandler = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void

const EMPTY_FORM: Omit<Form, 'payment'> = {
  name: '',
  email: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  stateCode: 'HR',
  pincode: '',
}

/** "+₹49.00" / "−₹99.98" for the summary row; the option row uses the compact "+₹49" / "−2%". */
const formatSigned = (paise: number): string =>
  `${paise < 0 ? '−' : '+'}${formatPaise(Math.abs(paise))}`

const isFullPincode = (v: string) => /^[1-9]\d{5}$/.test(v)

/** One line under the PIN code field: the promise, or why the address will not work. */
function deliveryLine(d: DeliveryEstimate | null, checking: boolean): string | null {
  if (checking) return content.delivery.checking
  if (!d?.ok) return null
  if (!d.serviceable) return content.delivery.unserviceable(d.pincode)
  return content.delivery.estimate(d.dateRange)
}

export default function CheckoutForm({ storeId, cart, methods, discount }: CheckoutFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [checking, startCheck] = useTransition()
  const [form, setForm] = useState<Form>({ ...EMPTY_FORM, payment: methods[0]?.id ?? 'cod' })
  const [delivery, setDelivery] = useState<DeliveryEstimate | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Helpers
  const set =
    (k: keyof Form): ChangeHandler =>
    (e) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }))
  /** Ask the courier as soon as six digits are in; the server re-checks on submit regardless. */
  const setPincode: ChangeHandler = (e) => {
    const pincode = e.target.value
    setForm((prev) => ({ ...prev, pincode }))
    setDelivery(null)
    if (!isFullPincode(pincode)) return
    startCheck(async () => {
      const r = await estimateDeliveryAction(storeId, pincode)
      setDelivery(r)
      if (r.ok && r.serviceable && !r.codAvailable) {
        setForm((prev) =>
          prev.payment === 'cod'
            ? { ...prev, payment: methods.find((m) => m.id !== 'cod')?.id ?? prev.payment }
            : prev,
        )
      }
    })
  }

  // Event handlers
  /* Save the contact as soon as it is typed, so a basket left here can be recovered. */
  const handleContactBlur = () => {
    if (!form.email.includes('@')) return
    void captureContactAction(storeId, {
      email: form.email,
      phone: form.phone,
      name: form.name,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const r = await checkoutAction(storeId, form)
      if (r?.error) setError(r.error)
    })
  }

  // Render logic
  // Preview only: placeOrder recomputes the discount and adjustment server-side.
  const selected = methods.find((m) => m.id === form.payment)
  const discountPaise = discount?.amountPaise ?? 0
  const discounted = Math.max(0, cart.subtotalPaise - discountPaise)
  const { adjustmentPaise, totalPaise } = applyPaymentAdjustment(discounted, selected?.adjustment)

  const f = content.fields
  const codBlocked = delivery?.ok === true && delivery.serviceable && !delivery.codAvailable
  const unserviceable = delivery?.ok === true && !delivery.serviceable
  const deliveryText = deliveryLine(delivery, checking)

  return (
    <section className="section-cart page-width">
      <h1 className="cart-page__title h2">{content.title}</h1>
      <form className="cart-layout" onSubmit={handleSubmit}>
        <div className="cart-layout__lines">
          <fieldset className="checkout__group">
            <legend className="h4">{content.contact}</legend>
            <CheckoutField
              label={f.name}
              required
              autoComplete="name"
              value={form.name}
              onChange={set('name')}
            />
            <CheckoutField
              label={f.email}
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
              onBlur={handleContactBlur}
            />
            <CheckoutField
              label={f.phone}
              type="tel"
              required
              pattern="[0-9]{10}"
              autoComplete="tel"
              value={form.phone}
              onChange={set('phone')}
            />
          </fieldset>

          <fieldset className="checkout__group">
            <legend className="h4">{content.address}</legend>
            <CheckoutField
              label={f.line1}
              required
              autoComplete="address-line1"
              value={form.line1}
              onChange={set('line1')}
            />
            <CheckoutField
              label={f.line2}
              autoComplete="address-line2"
              value={form.line2}
              onChange={set('line2')}
            />
            <div className="checkout__row">
              <CheckoutField
                label={f.city}
                required
                autoComplete="address-level2"
                value={form.city}
                onChange={set('city')}
              />
              <label className="field">
                <span className="field__label text-small">{f.state}</span>
                <select className="field__input" value={form.stateCode} onChange={set('stateCode')}>
                  {INDIAN_STATES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <CheckoutField
                label={f.pincode}
                required
                pattern="[1-9][0-9]{5}"
                autoComplete="postal-code"
                value={form.pincode}
                onChange={setPincode}
              />
            </div>
            {deliveryText ? (
              <p className={`checkout__delivery text-small${unserviceable ? ' is-negative' : ''}`}>
                {deliveryText}
              </p>
            ) : null}
          </fieldset>

          <fieldset className="checkout__group">
            <legend className="h4">{content.payment}</legend>
            {methods.map((m) => (
              <label
                key={m.id}
                className={`checkout__option${m.id === 'cod' && codBlocked ? ' is-disabled' : ''}`}
              >
                <input
                  type="radio"
                  name="payment"
                  value={m.id}
                  checked={form.payment === m.id}
                  disabled={m.id === 'cod' && codBlocked}
                  onChange={set('payment')}
                />
                <span className="checkout__option-label">{m.label}</span>
                {m.adjustment && m.adjustment.value !== 0 ? (
                  <span
                    className={`checkout__adjustment text-small${m.adjustment.value < 0 ? ' checkout__adjustment--discount' : ''}`}
                  >
                    {formatPaymentAdjustment(m.adjustment)}
                  </span>
                ) : null}
              </label>
            ))}
          </fieldset>
        </div>

        <aside className="cart-layout__summary">
          <div className="cart-summary">
            <h2 className="cart-summary__heading h4">{content.summary}</h2>
            {cart.lines.map((l) => (
              <div key={l.id} className="cart-summary__row">
                <span>
                  {l.productTitle} x {l.quantity}
                </span>
                <span>{formatPaise(l.linePaise)}</span>
              </div>
            ))}
            <DiscountCodeField storeId={storeId} discount={discount} />
            {adjustmentPaise !== 0 || discountPaise > 0 ? (
              <div className="cart-summary__row">
                <span>{content.subtotal}</span>
                <span>{formatPaise(cart.subtotalPaise)}</span>
              </div>
            ) : null}
            {discount?.label && discountPaise > 0 ? (
              <div className="cart-summary__row cart-summary__row--discount">
                <span>{discount.label}</span>
                <span>−{formatPaise(discountPaise)}</span>
              </div>
            ) : null}
            {adjustmentPaise !== 0 ? (
              <div className="cart-summary__row">
                <span>
                  {selected?.adjustment?.label || content.adjustmentFallback(adjustmentPaise)}
                </span>
                <span>{formatSigned(adjustmentPaise)}</span>
              </div>
            ) : null}
            <div className="cart-summary__row cart-summary__row--total">
              <span>{content.total}</span>
              <span>{formatPaise(totalPaise)}</span>
            </div>
            {error ? (
              <p className="checkout__error text-small" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              className={`btn btn--primary cart-summary__checkout${pending ? ' is-loading' : ''}`}
              disabled={pending || checking || unserviceable}
            >
              <span className="btn__label">
                {form.payment === 'cod' ? content.placeOrder : content.continueToPayment}
              </span>
            </button>
          </div>
        </aside>
      </form>
    </section>
  )
}
