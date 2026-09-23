'use client'

import { formatPaise } from '@commerce/blocks'
import type { CartView, DeliveryEstimate, SavedAddress, SignedInCustomer } from '@commerce/core'
import { applyPaymentAdjustment, formatPaymentAdjustment } from '@commerce/core/adjustments'
import { useEffect, useState, useTransition } from 'react'
import DiscountCodeField from '@/components/cart/discount-code-field'
import CheckoutField from '@/components/checkout/checkout-field'
import GiftCardField from '@/components/checkout/gift-card-field'
import { accountContent } from '@/data/account'
import { checkoutContent as content, INDIAN_STATES } from '@/data/checkout'
import { captureContactAction, checkoutAction, type CheckoutForm as Form } from '@/lib/cart-actions'
import type { CartDiscountView } from '@/lib/discount-actions'
import type { AppliedGiftCard } from '@/lib/gift-card-actions'
import type { CheckoutMethod } from '@/lib/payments'
import { estimateDeliveryAction } from '@/lib/shipping-actions'

type CheckoutFormProps = {
  storeId: string
  cart: CartView
  methods: CheckoutMethod[]
  /** Discount in force for this cart, resolved on the server. */
  discount: CartDiscountView | null
  /** The signed-in shopper, or null for guest checkout. */
  customer?: SignedInCustomer | null
  /** Their saved addresses, default first. */
  addresses?: SavedAddress[]
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

/** Contact and address fields from the account, so a returning shopper types nothing. */
function prefill(
  customer: SignedInCustomer | null,
  address: SavedAddress | undefined,
): Omit<Form, 'payment'> {
  return {
    ...EMPTY_FORM,
    name: address?.name ?? customer?.name ?? '',
    email: customer?.email ?? '',
    phone: address?.phone ?? customer?.phone ?? '',
    ...(address
      ? {
          line1: address.line1,
          line2: address.line2 ?? '',
          city: address.city,
          stateCode: address.stateCode,
          pincode: address.pincode,
        }
      : {}),
  }
}

const NEW_ADDRESS = 'new'

const accountCopy = accountContent.checkout

const savedLabel = (a: SavedAddress) => `${a.name}, ${a.line1}, ${a.city} ${a.pincode}`

/** How much each applied card covers, in order, and what is left to pay. Preview only. */
function spendCards(cards: AppliedGiftCard[], totalPaise: number) {
  let left = totalPaise
  const rows = cards.map((c) => {
    const amountPaise = Math.min(c.balancePaise, left)
    left -= amountPaise
    return { ...c, amountPaise }
  })
  return { rows, duePaise: left }
}

/** A basket of only gift cards: emailed, so no delivery check, and paid online. */
const isDigitalOnly = (cart: CartView): boolean =>
  cart.lines.length > 0 && cart.lines.every((l) => l.giftCard)

/** Methods on offer for this basket; COD never pays for gift cards. */
const offeredMethods = (cart: CartView, methods: CheckoutMethod[]): CheckoutMethod[] =>
  isDigitalOnly(cart) ? methods.filter((m) => m.id !== 'cod') : methods

/** One line under the PIN code field: the promise, or why the address will not work. */
function deliveryLine(d: DeliveryEstimate | null, checking: boolean): string | null {
  if (checking) return content.delivery.checking
  if (!d?.ok) return null
  if (!d.serviceable) return content.delivery.unserviceable(d.pincode)
  return content.delivery.estimate(d.dateRange)
}

export default function CheckoutForm({
  storeId,
  cart,
  methods,
  discount,
  customer = null,
  addresses = [],
}: CheckoutFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [checking, startCheck] = useTransition()
  const [form, setForm] = useState<Form>(() => ({
    ...prefill(customer, addresses[0]),
    payment: offeredMethods(cart, methods)[0]?.id ?? 'cod',
  }))
  const [savedId, setSavedId] = useState<string>(addresses[0]?.id ?? NEW_ADDRESS)
  const [delivery, setDelivery] = useState<DeliveryEstimate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [giftCards, setGiftCards] = useState<AppliedGiftCard[]>([])
  // A prefilled PIN code gets the same courier check a typed one does.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, for the address the page opened with.
  useEffect(() => {
    if (isFullPincode(form.pincode)) checkPincode(form.pincode)
  }, [])

  // Helpers
  const set =
    (k: keyof Form): ChangeHandler =>
    (e) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }))
  /** Ask the courier as soon as six digits are in; the server re-checks on submit regardless. */
  const checkPincode = (pincode: string) => {
    setDelivery(null)
    if (isDigitalOnly(cart) || !isFullPincode(pincode)) return
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
  const setPincode: ChangeHandler = (e) => {
    const pincode = e.target.value
    setForm((prev) => ({ ...prev, pincode }))
    checkPincode(pincode)
  }

  // Event handlers
  const handlePickAddress = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    setSavedId(id)
    const picked = addresses.find((a) => a.id === id)
    const next = picked
      ? prefill(customer, picked)
      : { ...prefill(customer, undefined), name: form.name, phone: form.phone }
    setForm((prev) => ({ ...prev, ...next }))
    checkPincode(next.pincode)
  }

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
      const r = await checkoutAction(storeId, { ...form, giftCards: giftCards.map((c) => c.code) })
      if (r?.error) setError(r.error)
    })
  }

  /* COD cannot collect what a gift card leaves; move to the first online method. */
  const handleGiftCardApply = (card: AppliedGiftCard) => {
    setGiftCards((prev) => [...prev, card])
    setForm((prev) =>
      prev.payment === 'cod'
        ? { ...prev, payment: methods.find((m) => m.id !== 'cod')?.id ?? prev.payment }
        : prev,
    )
  }

  const handleGiftCardRemove = (code: string) => {
    setGiftCards((prev) => prev.filter((c) => c.code !== code))
  }

  // Render logic
  const digitalOnly = isDigitalOnly(cart)
  const offered = offeredMethods(cart, methods)
  // Preview only: placeOrder recomputes the discount and adjustment server-side.
  const selected = methods.find((m) => m.id === form.payment)
  const discountPaise = discount?.amountPaise ?? 0
  const discounted = Math.max(0, cart.subtotalPaise - discountPaise)
  const { adjustmentPaise, totalPaise } = applyPaymentAdjustment(discounted, selected?.adjustment)

  const { rows: cardRows, duePaise } = spendCards(giftCards, totalPaise)
  const coveredByCards = giftCards.length > 0 && duePaise === 0

  const f = content.fields
  const codBlocked =
    (delivery?.ok === true && delivery.serviceable && !delivery.codAvailable) ||
    (giftCards.length > 0 && !coveredByCards)
  const unserviceable = delivery?.ok === true && !delivery.serviceable
  const deliveryText = deliveryLine(delivery, checking)

  return (
    <section className="section-cart page-width">
      <h1 className="cart-page__title h2">{content.title}</h1>
      <form className="cart-layout" onSubmit={handleSubmit}>
        <div className="cart-layout__lines">
          <fieldset className="checkout__group">
            <legend className="h4">{content.contact}</legend>
            {customer ? (
              <p className="text-small text-muted">{accountCopy.signedInAs(customer.email)}</p>
            ) : (
              <a
                href="/account/login?return_to=%2Fcheckout"
                className="text-small underline underline-offset-4"
              >
                {accountCopy.signIn}
              </a>
            )}
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
              readOnly={customer !== null}
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
            <legend className="h4">
              {digitalOnly ? content.giftCardAddress : content.address}
            </legend>
            {!digitalOnly && addresses.length > 0 ? (
              <label className="field">
                <span className="field__label text-small">{accountCopy.savedAddresses}</span>
                <select className="field__input" value={savedId} onChange={handlePickAddress}>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {savedLabel(a)}
                    </option>
                  ))}
                  <option value={NEW_ADDRESS}>{accountCopy.newAddress}</option>
                </select>
              </label>
            ) : null}
            {digitalOnly ? (
              <p className="checkout__delivery text-small">{content.giftCardDelivery}</p>
            ) : null}
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
            {offered.map((m) => (
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
                {m.id === 'cod' && giftCards.length > 0 && !coveredByCards ? (
                  <span className="checkout__adjustment text-small">{content.codWithGiftCard}</span>
                ) : null}
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
            {digitalOnly ? null : <DiscountCodeField storeId={storeId} discount={discount} />}
            {digitalOnly ? null : (
              <GiftCardField
                storeId={storeId}
                applied={giftCards}
                onApply={handleGiftCardApply}
                onRemove={handleGiftCardRemove}
              />
            )}
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
            {cardRows.map((c) => (
              <div key={c.code} className="cart-summary__row cart-summary__row--discount">
                <span>{content.paidByGiftCard}</span>
                <span>−{formatPaise(c.amountPaise)}</span>
              </div>
            ))}
            {giftCards.length > 0 ? (
              <div className="cart-summary__row cart-summary__row--total">
                <span>{content.totalDue}</span>
                <span>{formatPaise(duePaise)}</span>
              </div>
            ) : null}
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
                {form.payment === 'cod' || coveredByCards
                  ? content.placeOrder
                  : content.continueToPayment}
              </span>
            </button>
          </div>
        </aside>
      </form>
    </section>
  )
}
