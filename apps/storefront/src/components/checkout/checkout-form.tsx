'use client'

import { formatPaise } from '@commerce/blocks'
import type { CartView } from '@commerce/core'
import { applyPaymentAdjustment, formatPaymentAdjustment } from '@commerce/core/adjustments'
import { useState, useTransition } from 'react'
import { checkoutContent as content, INDIAN_STATES } from '@/data/checkout'
import { checkoutAction, type CheckoutForm as Form } from '@/lib/cart-actions'
import type { CheckoutMethod } from '@/lib/payments'

type CheckoutFormProps = {
  storeId: string
  cart: CartView
  methods: CheckoutMethod[]
}

type FieldProps = {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
  required?: boolean
  pattern?: string
  autoComplete?: string
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

function Field({
  label,
  type = 'text',
  required,
  pattern,
  autoComplete,
  value,
  onChange,
}: FieldProps) {
  return (
    <label className="field">
      <span className="field__label text-small">{label}</span>
      <input
        className="field__input"
        type={type}
        required={required}
        pattern={pattern}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
      />
    </label>
  )
}

export function CheckoutForm({ storeId, cart, methods }: CheckoutFormProps) {
  const [pending, start] = useTransition()
  const [form, setForm] = useState<Form>({ ...EMPTY_FORM, payment: methods[0]?.id ?? 'cod' })

  // Preview only: placeOrder recomputes the adjustment server-side from store settings.
  const selected = methods.find((m) => m.id === form.payment)
  const { adjustmentPaise, totalPaise } = applyPaymentAdjustment(
    cart.subtotalPaise,
    selected?.adjustment,
  )
  const f = content.fields

  const set =
    (k: keyof Form): ChangeHandler =>
    (e) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }))
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    start(() => checkoutAction(storeId, form))
  }

  return (
    <section className="section-cart page-width">
      <h1 className="cart-page__title h2">{content.title}</h1>
      <form className="cart-layout" onSubmit={handleSubmit}>
        <div className="cart-layout__lines">
          <fieldset className="checkout__group">
            <legend className="h4">{content.contact}</legend>
            <Field
              label={f.name}
              required
              autoComplete="name"
              value={form.name}
              onChange={set('name')}
            />
            <Field
              label={f.email}
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
            />
            <Field
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
            <Field
              label={f.line1}
              required
              autoComplete="address-line1"
              value={form.line1}
              onChange={set('line1')}
            />
            <Field
              label={f.line2}
              autoComplete="address-line2"
              value={form.line2}
              onChange={set('line2')}
            />
            <div className="checkout__row">
              <Field
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
              <Field
                label={f.pincode}
                required
                pattern="[1-9][0-9]{5}"
                autoComplete="postal-code"
                value={form.pincode}
                onChange={set('pincode')}
              />
            </div>
          </fieldset>

          <fieldset className="checkout__group">
            <legend className="h4">{content.payment}</legend>
            {methods.map((m) => (
              <label key={m.id} className="checkout__option">
                <input
                  type="radio"
                  name="payment"
                  value={m.id}
                  checked={form.payment === m.id}
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
            {adjustmentPaise !== 0 ? (
              <>
                <div className="cart-summary__row">
                  <span>{content.subtotal}</span>
                  <span>{formatPaise(cart.subtotalPaise)}</span>
                </div>
                <div className="cart-summary__row">
                  <span>
                    {selected?.adjustment?.label || content.adjustmentFallback(adjustmentPaise)}
                  </span>
                  <span>{formatSigned(adjustmentPaise)}</span>
                </div>
              </>
            ) : null}
            <div className="cart-summary__row cart-summary__row--total">
              <span>{content.total}</span>
              <span>{formatPaise(totalPaise)}</span>
            </div>
            <button
              type="submit"
              className={`btn btn--primary cart-summary__checkout${pending ? ' is-loading' : ''}`}
              disabled={pending}
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
