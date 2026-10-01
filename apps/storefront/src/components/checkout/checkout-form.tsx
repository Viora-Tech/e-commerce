'use client'

import type { CartView, SavedAddress, SignedInCustomer } from '@commerce/core'
import {
  applyPaymentAdjustment,
  formatPaymentAdjustment,
  type PaymentAdjustmentValue,
} from '@commerce/core/adjustment-math'
import {
  CHECKOUT_LIMITS,
  type CheckoutSettings,
  checkoutRuleSubtotalPaise,
  codDecision,
  minimumOrderShortfall,
} from '@commerce/core/checkout-settings'
import type { PolicyLink } from '@commerce/core/policies'
import { useEffect, useState, useTransition } from 'react'
import CheckoutAddressFields from '@/components/checkout/checkout-address-fields'
import CheckoutAgreement from '@/components/checkout/checkout-agreement'
import CheckoutContactFields from '@/components/checkout/checkout-contact-fields'
import CheckoutSummary, { type ShippingRow } from '@/components/checkout/checkout-summary'
import ShippingRateOptions from '@/components/checkout/shipping-rate-options'
import { checkoutContent as content } from '@/data/checkout'
import { captureContactAction, checkoutAction, type CheckoutForm as Form } from '@/lib/cart-actions'
import type { CartDiscountView } from '@/lib/discount-actions'
import type { AppliedGiftCard } from '@/lib/gift-card-actions'
import { formatPaise } from '@/lib/money'
import type { CheckoutMethod } from '@/lib/payments'
import type { CheckoutRate, CheckoutShipping } from '@/lib/shipping'
import { checkoutShippingAction } from '@/lib/shipping-actions'

type CheckoutFormProps = {
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
  /** Settings → Checkout; the server re-checks every rule on submit. */
  settings: CheckoutSettings
  /** Published store policies, linked above the button. */
  policies?: PolicyLink[]
}

type ChangeHandler = (
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
) => void

type FormState = Form & { gstin: string; businessName: string; note: string }

const EMPTY_FORM: Omit<FormState, 'payment'> = {
  name: '',
  email: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  stateCode: 'HR',
  pincode: '',
  gstin: '',
  businessName: '',
  note: '',
}

const isFullPincode = (v: string) => /^[1-9]\d{5}$/.test(v)

/** Contact and address fields from the account, so a returning shopper types nothing. */
function prefill(
  customer: SignedInCustomer | null,
  address: SavedAddress | undefined,
): Omit<FormState, 'payment'> {
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

/** Whether the applied cards cover the order before any payment fee; enough to decide COD, preview only. */
const coveredByCardsBefore = (cards: AppliedGiftCard[], goodsPaise: number): boolean =>
  cards.reduce((sum, c) => sum + c.balancePaise, 0) >= goodsPaise

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
): PaymentAdjustmentValue | undefined {
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
  cart,
  methods,
  discount,
  customer = null,
  addresses = [],
  nonRefundableDepositDays = null,
  settings,
  policies = [],
}: CheckoutFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [checking, startCheck] = useTransition()
  const [form, setForm] = useState<FormState>(() => ({
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
    (k: keyof FormState): ChangeHandler =>
    (e) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }))
  /** Ask the courier as soon as six digits are in; the server re-checks on submit regardless. */
  const checkPincode = (pincode: string, stateCode: string = form.stateCode) => {
    setShipping(null)
    if (isDigitalOnly(cart) || !isFullPincode(pincode)) return
    startCheck(async () => {
      const next = await checkoutShippingAction({ pincode, stateCode })
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
  const setPincode = (pincode: string) => {
    setForm((prev) => ({ ...prev, pincode }))
    checkPincode(pincode)
  }
  /** Zones can be drawn by state, so a new state re-prices shipping. */
  const setStateCode = (stateCode: string) => {
    setForm((prev) => ({ ...prev, stateCode }))
    checkPincode(form.pincode, stateCode)
  }
  /** PIN code first: the directory's city and state, still editable; shipping re-quotes for the state. */
  const setPlace = (place: { city: string; stateCode: string }, pincode: string) => {
    setForm((prev) => ({ ...prev, city: place.city, stateCode: place.stateCode }))
    if (place.stateCode !== form.stateCode) checkPincode(pincode, place.stateCode)
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
    if (!form.email.includes('@') && form.phone.replace(/\D/g, '').length < 10) return
    void captureContactAction({
      email: form.email,
      phone: form.phone,
      name: form.name,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const r = await checkoutAction({
        ...form,
        payment,
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
  const discountPaise = discount?.amountPaise ?? 0
  const discounted = Math.max(0, cart.subtotalPaise - discountPaise)
  const rates = shipping?.rates.kind === 'rates' ? shipping.rates.options : []
  const rate = rates.find((r) => r.id === rateId)
  const delivery = shipping?.delivery
  // Settings → Checkout's COD limit and minimum, previewed here; placeOrder enforces them.
  // Both judge only the lines that are not gift cards.
  const ruleSubtotal = checkoutRuleSubtotalPaise(cart.lines, discountPaise)
  const orderValuePaise = discounted + (digitalOnly ? 0 : (rate?.pricePaise ?? 0))
  const codRule = codDecision(settings.cod, {
    pincode: form.pincode,
    orderValuePaise: ruleSubtotal + (digitalOnly ? 0 : (rate?.pricePaise ?? 0)),
  })
  const codBlocked =
    (delivery?.ok === true && delivery.serviceable && !delivery.codAvailable) ||
    (giftCards.length > 0 && !coveredByCardsBefore(giftCards, orderValuePaise)) ||
    !codRule.allowed
  // A blocked COD pick moves to the first online method rather than failing on submit.
  const payment =
    form.payment === 'cod' && codBlocked
      ? (offered.find((m) => m.id !== 'cod')?.id ?? form.payment)
      : form.payment
  // Preview only: placeOrder recomputes the discount and adjustment server-side.
  const selected = methods.find((m) => m.id === payment)
  const adjustment = previewAdjustment(selected, rate)
  const { adjustmentPaise, totalPaise: goodsPaise } = applyPaymentAdjustment(discounted, adjustment)
  const totalPaise = goodsPaise + (digitalOnly ? 0 : (rate?.pricePaise ?? 0))
  const shippingSummary = shippingRow(digitalOnly, shipping, rate)

  const { rows: cardRows, duePaise } = spendCards(giftCards, totalPaise)
  const coveredByCards = giftCards.length > 0 && duePaise === 0

  const shortfall = digitalOnly ? 0 : minimumOrderShortfall(settings, ruleSubtotal)
  const codNote = codRule.allowed
    ? null
    : codRule.reason === 'blocked_pincode'
      ? content.codRules.blockedPincode
      : content.codRules.overLimit(formatPaise(codRule.limitPaise ?? 0))
  const unserviceable =
    (delivery?.ok === true && !delivery.serviceable) || shipping?.rates.kind === 'none'
  const deliveryText = deliveryLine(shipping, checking)

  return (
    <section className="section-cart page-width">
      <h1 className="cart-page__title h2">{content.title}</h1>
      <form className="cart-layout" onSubmit={handleSubmit}>
        <div className="cart-layout__lines">
          <CheckoutContactFields
            values={form}
            customer={customer}
            emailOptional={settings.email === 'optional'}
            gstinEnabled={settings.gstin}
            onField={set}
            onContactBlur={handleContactBlur}
          />

          <CheckoutAddressFields
            values={form}
            digitalOnly={digitalOnly}
            pincodeFirst={settings.pincodeFirst}
            addresses={addresses}
            savedId={savedId}
            newAddressId={NEW_ADDRESS}
            deliveryText={deliveryText}
            unserviceable={unserviceable}
            onPickAddress={handlePickAddress}
            onField={set}
            onPincode={setPincode}
            onState={setStateCode}
            onPlace={setPlace}
          />

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
                  checked={payment === m.id}
                  disabled={m.id === 'cod' && codBlocked}
                  onChange={set('payment')}
                />
                <span className="checkout__option-label">
                  {m.methods?.length ? content.payOnline : m.label}
                  {m.methods?.length ? (
                    <span className="checkout__option-meta text-small">
                      {m.methods.map((id) => content.onlineMethodNames[id]).join(' · ')}
                    </span>
                  ) : null}
                </span>
                {m.id === 'cod' && giftCards.length > 0 && !coveredByCards ? (
                  <span className="checkout__adjustment text-small">{content.codWithGiftCard}</span>
                ) : m.id === 'cod' && codNote ? (
                  <span className="checkout__adjustment text-small">{codNote}</span>
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

          {settings.orderNotes ? (
            <label className="field">
              <span className="field__label text-small">{content.fields.note}</span>
              <textarea
                className="field__input"
                rows={3}
                maxLength={CHECKOUT_LIMITS.note}
                placeholder={content.fields.notePlaceholder}
                value={form.note}
                onChange={set('note')}
              />
            </label>
          ) : null}
        </div>

        <CheckoutSummary
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
          footnote={
            <>
              {shortfall > 0 ? (
                <p className="checkout__error text-small" role="status">
                  {content.minimumOrder(
                    formatPaise(settings.minimumOrderPaise),
                    formatPaise(shortfall),
                  )}
                </p>
              ) : null}
              <CheckoutAgreement policies={policies} />
            </>
          }
          pending={pending}
          submitDisabled={pending || checking || unserviceable || shortfall > 0}
          submitLabel={
            payment === 'cod' || coveredByCards ? content.placeOrder : content.continueToPayment
          }
        />
      </form>
    </section>
  )
}
