'use client'

import { formatPaise } from '@commerce/blocks'
import type { CartView } from '@commerce/core'
import { useState, useTransition } from 'react'
import { checkoutAction, type CheckoutForm as Form } from '@/lib/cart-actions'

const STATES: readonly [string, string][] = [
  ['AP', 'Andhra Pradesh'],
  ['AR', 'Arunachal Pradesh'],
  ['AS', 'Assam'],
  ['BR', 'Bihar'],
  ['CG', 'Chhattisgarh'],
  ['CH', 'Chandigarh'],
  ['DL', 'Delhi'],
  ['GA', 'Goa'],
  ['GJ', 'Gujarat'],
  ['HR', 'Haryana'],
  ['HP', 'Himachal Pradesh'],
  ['JK', 'Jammu and Kashmir'],
  ['JH', 'Jharkhand'],
  ['KA', 'Karnataka'],
  ['KL', 'Kerala'],
  ['LA', 'Ladakh'],
  ['MP', 'Madhya Pradesh'],
  ['MH', 'Maharashtra'],
  ['MN', 'Manipur'],
  ['ML', 'Meghalaya'],
  ['MZ', 'Mizoram'],
  ['NL', 'Nagaland'],
  ['OD', 'Odisha'],
  ['PY', 'Puducherry'],
  ['PB', 'Punjab'],
  ['RJ', 'Rajasthan'],
  ['SK', 'Sikkim'],
  ['TN', 'Tamil Nadu'],
  ['TS', 'Telangana'],
  ['TR', 'Tripura'],
  ['UP', 'Uttar Pradesh'],
  ['UK', 'Uttarakhand'],
  ['WB', 'West Bengal'],
]

type FieldProps = {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
  required?: boolean
  pattern?: string
  autoComplete?: string
}

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

export function CheckoutForm({ storeId, cart }: { storeId: string; cart: CartView }) {
  const [pending, start] = useTransition()
  const [form, setForm] = useState<Form>({
    name: '',
    email: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    stateCode: 'HR',
    pincode: '',
    payment: 'cod',
  })
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <section className="section-cart page-width">
      <h1 className="cart-page__title h2">Checkout</h1>
      <form
        className="cart-layout"
        onSubmit={(e) => {
          e.preventDefault()
          start(() => checkoutAction(storeId, form))
        }}
      >
        <div className="cart-layout__lines">
          <fieldset className="checkout__group">
            <legend className="h4">Contact</legend>
            <Field
              label="Name"
              required
              autoComplete="name"
              value={form.name}
              onChange={set('name')}
            />
            <Field
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
            />
            <Field
              label="Phone"
              type="tel"
              required
              pattern="[0-9]{10}"
              autoComplete="tel"
              value={form.phone}
              onChange={set('phone')}
            />
          </fieldset>

          <fieldset className="checkout__group">
            <legend className="h4">Delivery address</legend>
            <Field
              label="Address"
              required
              autoComplete="address-line1"
              value={form.line1}
              onChange={set('line1')}
            />
            <Field
              label="Apartment, landmark (optional)"
              autoComplete="address-line2"
              value={form.line2}
              onChange={set('line2')}
            />
            <div className="checkout__row">
              <Field
                label="City"
                required
                autoComplete="address-level2"
                value={form.city}
                onChange={set('city')}
              />
              <label className="field">
                <span className="field__label text-small">State</span>
                <select className="field__input" value={form.stateCode} onChange={set('stateCode')}>
                  {STATES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Pincode"
                required
                pattern="[1-9][0-9]{5}"
                autoComplete="postal-code"
                value={form.pincode}
                onChange={set('pincode')}
              />
            </div>
          </fieldset>

          <fieldset className="checkout__group">
            <legend className="h4">Payment</legend>
            <label className="checkout__option">
              <input
                type="radio"
                name="payment"
                value="cod"
                checked={form.payment === 'cod'}
                onChange={set('payment')}
              />
              <span>Cash on delivery</span>
            </label>
            <label className="checkout__option">
              <input
                type="radio"
                name="payment"
                value="online"
                checked={form.payment === 'online'}
                onChange={set('payment')}
              />
              <span>Pay now with UPI or card (test gateway until Razorpay is connected)</span>
            </label>
          </fieldset>
        </div>

        <aside className="cart-layout__summary">
          <div className="cart-summary">
            <h2 className="cart-summary__heading h4">Order summary</h2>
            {cart.lines.map((l) => (
              <div key={l.id} className="cart-summary__row">
                <span>
                  {l.productTitle} x {l.quantity}
                </span>
                <span>{formatPaise(l.linePaise)}</span>
              </div>
            ))}
            <div className="cart-summary__row cart-summary__row--total">
              <span>Total</span>
              <span>{formatPaise(cart.subtotalPaise)}</span>
            </div>
            <button
              type="submit"
              className={`btn btn--primary cart-summary__checkout${pending ? ' is-loading' : ''}`}
              disabled={pending}
            >
              <span className="btn__label">
                {form.payment === 'cod' ? 'Place order' : 'Pay and place order'}
              </span>
            </button>
          </div>
        </aside>
      </form>
    </section>
  )
}
