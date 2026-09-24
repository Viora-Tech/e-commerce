'use client'

import type { CartView, SavedAddress, SignedInCustomer } from '@commerce/core'
import {
  applyPaymentAdjustment,
  formatPaymentAdjustment,
  type PaymentAdjustment,
} from '@commerce/core/adjustments'
import { useEffect, useState, useTransition } from 'react'
import CheckoutField from '@/components/checkout/checkout-field'
import CheckoutSummary, { type ShippingRow } from '@/components/checkout/checkout-summary'
import ShippingRateOptions from '@/components/checkout/shipping-rate-options'
import { accountContent } from '@/data/account'
import { checkoutContent as content, INDIAN_STATES } from '@/data/checkout'
import { captureContactAction, checkoutAction, type CheckoutForm as Form } from '@/lib/cart-actions'
import type { CartDiscountView } from '@/lib/discount-actions'
import type { AppliedGiftCard } from '@/lib/gift-card-actions'
import type { CheckoutMethod } from '@/lib/payments'
import type { CheckoutRate, CheckoutShipping } from '@/lib/shipping'
import { checkoutShippingAction } from '@/lib/shipping-actions'

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
  /** Set when the cart has a deposit pre-order and the store keeps unpaid deposits. */
  nonRefundableDepositDays?: number | null
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
function deliveryLine(s: CheckoutShipping | null, checking: boolean): string | null {
  if (checking) return content.delivery.checking
  const d = s?.delivery
  if (!d?.ok) return null
  if (!d.serviceable) return content.delivery.unserviceable(d.pincode)
  if (s?.rates.kind === 'none') return content.delivery.noRates(d.pincode)
  // Several rates carry their own dates on the options below.
  if (s?.rates.kind === 'rates' && s.rates.options.length > 1) return null
  const own = s?.rates.kind === 'rates' ? s.rates.options[0]?.dateRange : null
  return content.delivery.estimate(own ?? d.dateRange)
}

/**
 * The payment fee the order will carry: a rate's own COD fee replaces the
 * store's, as `placeOrder` does. Preview only; the server decides.
 */
function previewAdjustment(
  method: CheckoutMethod | undefined,
  rate: CheckoutRate | undefined,
): PaymentAdjustment | undefined {
  if (method?.id !== 'cod' || rate?.codSurchargePaise == null) return method?.adjustment
  return { type: 'fixed', value: rate.codSurchargePaise, label: method.adjustment?.label }
}

/** The summary's shipping row: nothing to ship, not checked yet, or the picked rate. */
function shippingRow(
  digitalOnly: boolean,
  s: CheckoutShipping | null,
  rate: CheckoutRate | undefined,
): ShippingRow | null {
  if (digitalOnly) return null
  if (s?.rates.kind === 'free') return { kind: 'price', paise: 0, name: null }
  if (!rate) return { kind: 'pending' }
  return { kind: 'price', paise: rate.pricePaise, name: rate.name }
}

export default function CheckoutForm({
  storeId,
  cart,
  methods,
  discount,
  customer = null,
  addresses = [],
  nonRefundableDepositDays = null,
}: CheckoutFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [checking, startCheck] = useTransition()
  const [form, setForm] = useState<Form>(() => ({
    ...prefill(customer, addresses[0]),
    payment: offeredMethods(cart, methods)[0]?.id ?? 'cod',
  }))
  const [savedId, setSavedId] = useState<string>(addresses[0]?.id ?? NEW_ADDRESS)
  const [shipping, setShipping] = useState<CheckoutShipping | null>(null)
  const [rateId, setRateId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [giftCards, setGiftCards] = useState<AppliedGiftCard[]>([])
  // A prefilled PIN code gets the same courier check a typed one does.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, for the address the page opened with.
  useEffect(() => {
    if (isFullPincode(form.pincode)) checkPincode(form.pincode)
  }, [])
  // A code applied in the summary can move the cart across a band or make shipping free.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-quote only when the discount changes.
  useEffect(() => {
    if (isFullPincode(form.pincode)) checkPincode(form.pincode)
  }, [discount?.amountPaise, discount?.freeShipping])

  // Helpers
  const set =
    (k: keyof Form): ChangeHandler =>
    (e) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }))
  /** Ask the courier as soon as six digits are in; the server re-checks on submit regardless. */
  const checkPincode = (pincode: string, stateCode: string = form.stateCode) => {
    setShipping(null)
    if (isDigitalOnly(cart) || !isFullPincode(pincode)) return
    startCheck(async () => {
      const next = await checkoutShippingAction(storeId, { pincode, stateCode })
      setShipping(next)
      // Keep the shopper's pick when it is still offered, else the cheapest.
      const options = next?.rates.kind === 'rates' ? next.rates.options : []
      setRateId((prev) => (options.some((o) => o.id === prev) ? prev : (options[0]?.id ?? null)))
      const r = next?.delivery
      if (r?.ok && r.serviceable && !r.codAvailable) {
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
  /** Zones can be drawn by state, so a new state re-prices shipping. */
  const setStateCode: ChangeHandler = (e) => {
    const stateCode = e.target.value
    setForm((prev) => ({ ...prev, stateCode }))
    checkPincode(form.pincode, stateCode)
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
    checkPincode(next.pincode, next.stateCode)
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
      const r = await checkoutAction(storeId, {
        ...form,
        giftCards: giftCards.map((c) => c.code),
        ...(rateId ? { shippingRate: rateId } : {}),
      })
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
  const rates = shipping?.rates.kind === 'rates' ? shipping.rates.options : []
  const rate = rates.find((r) => r.id === rateId)
  const adjustment = previewAdjustment(selected, rate)
  const { adjustmentPaise, totalPaise: goodsPaise } = applyPaymentAdjustment(discounted, adjustment)
  const totalPaise = goodsPaise + (digitalOnly ? 0 : (rate?.pricePaise ?? 0))
  const shippingSummary = shippingRow(digitalOnly, shipping, rate)

  const { rows: cardRows, duePaise } = spendCards(giftCards, totalPaise)
  const coveredByCards = giftCards.length > 0 && duePaise === 0

  const f = content.fields
  const delivery = shipping?.delivery
  const codBlocked =
    (delivery?.ok === true && delivery.serviceable && !delivery.codAvailable) ||
    (giftCards.length > 0 && !coveredByCards)
  const unserviceable =
    (delivery?.ok === true && !delivery.serviceable) || shipping?.rates.kind === 'none'
  const deliveryText = deliveryLine(shipping, checking)

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
                <select className="field__input" value={form.stateCode} onChange={setStateCode}>
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

          {rates.length > 1 ? (
            <ShippingRateOptions options={rates} selectedId={rateId} onSelect={setRateId} />
          ) : null}

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

        <CheckoutSummary
          storeId={storeId}
          cart={cart}
          discount={discount}
          digitalOnly={digitalOnly}
          giftCards={giftCards}
          onGiftCardApply={handleGiftCardApply}
          onGiftCardRemove={handleGiftCardRemove}
          adjustmentPaise={adjustmentPaise}
          adjustmentLabel={adjustment?.label || content.adjustmentFallback(adjustmentPaise)}
          shipping={shippingSummary}
          totalPaise={totalPaise}
          cardRows={cardRows}
          duePaise={duePaise}
          error={error}
          notice={
            nonRefundableDepositDays ? content.depositNonRefundable(nonRefundableDepositDays) : null
          }
          pending={pending}
          submitDisabled={pending || checking || unserviceable}
          submitLabel={
            form.payment === 'cod' || coveredByCards
              ? content.placeOrder
              : content.continueToPayment
          }
        />
      </form>
    </section>
  )
}
