'use client'

import { formatPaise } from '@commerce/blocks'
import type { CartView, CheckoutLook, SavedAddress, SignedInCustomer } from '@commerce/core'
import {
  CHECKOUT_LIMITS,
  type CheckoutSettings,
  stateForPincode,
} from '@commerce/core/checkout-settings'
import { lowestEmiPaise } from '@commerce/core/emi'
import type { PolicyLink } from '@commerce/core/policies'
import { useEffect, useState, useTransition } from 'react'
import CheckoutAddressFields from '@/components/checkout/checkout-address-fields'
import CheckoutContactFields from '@/components/checkout/checkout-contact-fields'
import CheckoutPayFooter from '@/components/checkout/checkout-pay-footer'
import CheckoutSection from '@/components/checkout/checkout-section'
import CheckoutShell from '@/components/checkout/checkout-shell'
import CheckoutSummary from '@/components/checkout/checkout-summary'
import DeliveryMethod from '@/components/checkout/delivery-method'
import ExpressPay from '@/components/checkout/express-pay'
import PaymentMethods from '@/components/checkout/payment-methods'
import SummaryDisclosure from '@/components/checkout/summary-disclosure'
import { accountContent } from '@/data/account'
import { checkoutContent as content } from '@/data/checkout'
import { captureContactAction, checkoutAction } from '@/lib/cart-actions'
import { CK_INPUT, CK_LABEL, CK_LINK } from '@/lib/checkout-classes'
import { type CheckoutFormState, NEW_ADDRESS, prefillCheckout } from '@/lib/checkout-form-state'
import {
  checkoutTotals,
  deliveryLine,
  isDigitalOnly,
  offeredMethods,
  shippingRow,
  takesUpi,
  trustMethodNames,
} from '@/lib/checkout-preview'
import {
  type CheckoutFieldKey,
  checkoutFieldErrors,
  cleanPincode,
  fieldId,
  fieldOrder,
} from '@/lib/checkout-validation'
import type { CartDiscountView } from '@/lib/discount-view'
import type { AppliedGiftCard } from '@/lib/gift-card-actions'
import type { CheckoutMethod } from '@/lib/payments'
import type { CartDepositTerms } from '@/lib/preorder'
import type { CheckoutShipping } from '@/lib/shipping'
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
  /** Deposit pre-orders: the balance left for later and the store's deposit terms. */
  deposit?: CartDepositTerms
  /** Settings → Checkout; the server re-checks every rule on submit. */
  settings: CheckoutSettings
  /** Published store policies, linked above the button. */
  policies?: PolicyLink[]
  /** Settings → Checkout → Branding, the store name and logo. */
  look: CheckoutLook
  /** The smallest amount the store offers EMI on; null when it offers none. */
  emiMinPaise?: number | null
}

type ChangeHandler = (
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
) => void

const NO_DEPOSIT: CartDepositTerms = { laterPaise: 0, nonRefundableDays: null }

const isFullPincode = (v: string) => /^[1-9]\d{5}$/.test(cleanPincode(v))

/**
 * The locked checkout: the order summary on the left, the steps on the right (contact,
 * delivery, delivery method, payment) on one page, UPI first. Every amount here is a
 * preview; `checkoutAction` and `placeOrder` re-check and re-price everything.
 */
export default function CheckoutForm({
  cart,
  methods,
  discount,
  customer = null,
  addresses = [],
  deposit = NO_DEPOSIT,
  settings,
  policies = [],
  look,
  emiMinPaise = null,
}: CheckoutFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [checking, startCheck] = useTransition()
  const [form, setForm] = useState<CheckoutFormState>(() => ({
    ...prefillCheckout(customer, addresses[0]),
    payment: offeredMethods(cart, methods)[0]?.id ?? 'cod',
  }))
  const [savedId, setSavedId] = useState<string>(addresses[0]?.id ?? NEW_ADDRESS)
  const [business, setBusiness] = useState(false)
  const [shipping, setShipping] = useState<CheckoutShipping | null>(null)
  const [rateId, setRateId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [giftCards, setGiftCards] = useState<AppliedGiftCard[]>([])
  const [touched, setTouched] = useState<Partial<Record<CheckoutFieldKey, true>>>({})
  const [attempted, setAttempted] = useState(false)
  const [expressNote, setExpressNote] = useState<string | null>(null)
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
    (k: keyof CheckoutFormState): ChangeHandler =>
    (e) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }))
  const touch = (k: CheckoutFieldKey) =>
    setTouched((prev) => (prev[k] ? prev : { ...prev, [k]: true }))
  /** Ask the courier as soon as six digits are in; the server re-checks on submit regardless. */
  const checkPincode = (raw: string, stateCode: string = form.stateCode) => {
    setShipping(null)
    const pincode = cleanPincode(raw)
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
  /** A PIN code whose prefix allows one state fills it in, unless the shopper picked one. */
  const setPincode = (pincode: string) => {
    const guess = touched.stateCode ? null : stateForPincode(cleanPincode(pincode))
    const stateCode = guess ?? form.stateCode
    setForm((prev) => ({ ...prev, pincode, stateCode }))
    checkPincode(pincode, stateCode)
  }
  /** Zones can be drawn by state, so a new state re-prices shipping. */
  const setStateCode = (stateCode: string) => {
    setForm((prev) => ({ ...prev, stateCode }))
    touch('stateCode')
    checkPincode(form.pincode, stateCode)
  }
  /** PIN code first: the directory's city and state, still editable; shipping re-quotes for the state. */
  const setPlace = (place: { city: string; stateCode: string }, pincode: string) => {
    setForm((prev) => ({ ...prev, city: place.city, stateCode: place.stateCode }))
    if (place.stateCode !== form.stateCode) checkPincode(pincode, place.stateCode)
  }
  /** Place the order with this way to pay, or point at the first field that needs fixing. */
  const submit = (paymentId: string): boolean => {
    const wrong = fieldOrder(settings.pincodeFirst).filter((k) => fieldErrors[k])
    setAttempted(true)
    if (wrong.length > 0) {
      setError(null)
      document.getElementById(fieldId(wrong[0] as CheckoutFieldKey))?.focus()
      return false
    }
    setError(null)
    start(async () => {
      const r = await checkoutAction({
        ...form,
        pincode: cleanPincode(form.pincode),
        payment: paymentId,
        giftCards: giftCards.map((c) => c.code),
        ...(rateId ? { shippingRate: rateId } : {}),
      })
      if (r?.error) setError(r.error)
    })
    return true
  }

  // Event handlers
  const handlePickAddress = (id: string) => {
    setSavedId(id)
    const picked = addresses.find((a) => a.id === id)
    const next = picked
      ? prefillCheckout(customer, picked)
      : { ...prefillCheckout(customer, undefined), name: form.name, phone: form.phone }
    setForm((prev) => ({ ...prev, ...next }))
    checkPincode(next.pincode, next.stateCode)
  }

  /* Leaving a field shows its check; leaving the contact saves it, so a basket left here can be recovered. */
  const handleLeave = (key: CheckoutFieldKey) => {
    touch(key)
    if (key !== 'email' && key !== 'phone') return
    if (!form.email.includes('@') && form.phone.replace(/\D/g, '').length < 10) return
    void captureContactAction({ email: form.email, phone: form.phone, name: form.name })
  }

  const handleBusiness = (on: boolean) => {
    setBusiness(on)
    if (!on) setForm((prev) => ({ ...prev, gstin: '', businessName: '' }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setExpressNote(null)
    submit(payment)
  }

  /* Express UPI: pick the UPI method and pay at once when the details are in. */
  const handleExpress = () => {
    if (!upi) return
    setForm((prev) => ({ ...prev, payment: upi.id }))
    setExpressNote(submit(upi.id) ? null : content.express.needDetails)
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
  const fieldErrors = checkoutFieldErrors(form, {
    emailRequired: settings.email === 'required' || Boolean(customer?.email),
    gstin: business,
  })
  const shownErrors = attempted
    ? fieldErrors
    : Object.fromEntries(
        Object.entries(fieldErrors).filter(([k]) => touched[k as CheckoutFieldKey]),
      )
  const rates = shipping?.rates.kind === 'rates' ? shipping.rates.options : []
  const rate = rates.find((r) => r.id === rateId)
  const totals = checkoutTotals({
    cart,
    methods,
    settings,
    discountPaise: discount?.amountPaise ?? 0,
    shipping,
    rate,
    giftCards,
    picked: form.payment,
    pincode: form.pincode,
    laterPaise: deposit.laterPaise,
  })
  const { digitalOnly, offered, payment, coveredByCards, payNowPaise, codBlocked } = totals
  const shortfall = totals.shortfallPaise
  const payNow = formatPaise(payNowPaise)
  const delivery = shipping?.delivery
  const unserviceable =
    (delivery?.ok === true && !delivery.serviceable) || shipping?.rates.kind === 'none'
  const deliveryText = deliveryLine(shipping, checking)
  const upi = offered.find(takesUpi)
  const updating = checking && !digitalOnly
  const emiMonthly =
    emiMinPaise !== null && payNowPaise >= emiMinPaise && payNowPaise > 0
      ? formatPaise(lowestEmiPaise(payNowPaise))
      : null
  const payLabel = coveredByCards
    ? content.placeOrder
    : payment === 'cod'
      ? content.placeOrderAmount(payNow)
      : content.pay(payNow)
  const steps = digitalOnly ? 3 : 4
  const contactDone = !fieldErrors.email && !fieldErrors.phone
  const addressKeys: CheckoutFieldKey[] = ['pincode', 'name', 'line1', 'city', 'stateCode', 'gstin']
  const addressDone = addressKeys.every((k) => !fieldErrors[k])
  const toFix = attempted
    ? fieldOrder(settings.pincodeFirst).filter((k) => fieldErrors[k]).length
    : 0
  const methodDone = !unserviceable && (shipping?.rates.kind === 'free' || rate !== undefined)

  return (
    <CheckoutShell
      look={look}
      backHref="/cart"
      backLabel={content.backToCart}
      summary={
        <SummaryDisclosure totalLabel={payNow} updating={updating}>
          <CheckoutSummary
            cart={cart}
            discount={discount}
            digitalOnly={digitalOnly}
            giftCards={giftCards}
            onGiftCardApply={handleGiftCardApply}
            onGiftCardRemove={handleGiftCardRemove}
            adjustmentPaise={totals.adjustmentPaise}
            adjustmentLabel={
              totals.adjustment?.label || content.adjustmentFallback(totals.adjustmentPaise)
            }
            shipping={shippingRow(digitalOnly, shipping, rate)}
            totalPaise={totals.totalPaise}
            cardRows={totals.cardRows}
            duePaise={totals.duePaise}
            laterPaise={deposit.laterPaise}
            payNowPaise={payNowPaise}
            emiMonthly={emiMonthly}
            notice={
              deposit.nonRefundableDays
                ? content.depositNonRefundable(deposit.nonRefundableDays)
                : null
            }
            updating={updating}
          />
        </SummaryDisclosure>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h1 className="sr-only">{content.title}</h1>
        {upi && !coveredByCards ? (
          <ExpressPay
            amountLabel={payNow}
            pending={pending}
            disabled={updating || unserviceable || shortfall > 0}
            message={expressNote}
            onPay={handleExpress}
          />
        ) : null}

        <CheckoutSection
          id="checkout-contact"
          step={1}
          steps={steps}
          title={content.contact}
          done={contactDone}
          aside={
            customer ? null : (
              <a href="/account/login?return_to=%2Fcheckout" className={CK_LINK}>
                {accountContent.checkout.signIn}
              </a>
            )
          }
        >
          <CheckoutContactFields
            values={form}
            errors={shownErrors}
            customer={customer}
            emailOptional={settings.email === 'optional'}
            onField={set}
            onPhone={(phone) => setForm((prev) => ({ ...prev, phone }))}
            onLeave={handleLeave}
          />
        </CheckoutSection>

        <CheckoutSection
          id="checkout-delivery"
          step={2}
          steps={steps}
          title={digitalOnly ? content.giftCardAddress : content.address}
          done={addressDone}
        >
          <CheckoutAddressFields
            values={form}
            errors={shownErrors}
            digitalOnly={digitalOnly}
            pincodeFirst={settings.pincodeFirst}
            gstinEnabled={settings.gstin}
            business={business}
            addresses={addresses}
            savedId={savedId}
            newAddressId={NEW_ADDRESS}
            deliveryText={unserviceable ? null : deliveryText}
            checking={checking}
            onPickAddress={handlePickAddress}
            onField={set}
            onLeave={handleLeave}
            onPincode={setPincode}
            onState={setStateCode}
            onBusiness={handleBusiness}
            onPlace={setPlace}
          />
        </CheckoutSection>

        {digitalOnly ? null : (
          <CheckoutSection
            id="checkout-method"
            step={3}
            steps={steps}
            title={content.deliveryMethod}
            done={methodDone}
          >
            <DeliveryMethod
              shipping={shipping}
              rates={rates}
              selectedId={rateId}
              checking={checking}
              unserviceable={unserviceable}
              estimate={deliveryText}
              onSelect={setRateId}
            />
          </CheckoutSection>
        )}

        <CheckoutSection id="checkout-payment" step={steps} steps={steps} title={content.payment}>
          {coveredByCards ? (
            <p className="text-[0.875rem] text-ck-muted">{content.paidByGiftCard}</p>
          ) : (
            <PaymentMethods
              methods={offered}
              selected={payment}
              codBlocked={codBlocked}
              codNote={totals.codNote}
              onSelect={(id) => setForm((prev) => ({ ...prev, payment: id }))}
            />
          )}
          {settings.orderNotes ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="checkout-note" className={CK_LABEL}>
                {content.fields.note}
              </label>
              <textarea
                id="checkout-note"
                className={`${CK_INPUT} min-h-[5.5rem] resize-y py-3`}
                rows={3}
                maxLength={CHECKOUT_LIMITS.note}
                placeholder={content.fields.notePlaceholder}
                value={form.note}
                onChange={set('note')}
              />
            </div>
          ) : null}
        </CheckoutSection>

        <CheckoutPayFooter
          error={error ?? (toFix > 0 ? content.validation.fixFields(toFix) : null)}
          shortfall={
            shortfall > 0
              ? content.minimumOrder(
                  formatPaise(settings.minimumOrderPaise),
                  formatPaise(shortfall),
                )
              : null
          }
          payLabel={payLabel}
          pending={pending}
          updating={updating}
          disabled={unserviceable || shortfall > 0}
          policies={policies}
          trust={look.branding.trustBadges ? trustMethodNames(offered) : null}
        />
      </form>
    </CheckoutShell>
  )
}
