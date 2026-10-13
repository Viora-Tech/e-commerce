import { formatPaise } from '@commerce/blocks'
import type { CartView, CheckoutLook, SavedAddress, SignedInCustomer } from '@commerce/core'
import { type CheckoutSettings, stateForPincode } from '@commerce/core/checkout-settings'
import { lowestEmiPaise } from '@commerce/core/emi'
import type { PolicyLink } from '@commerce/core/policies'
import { useEffect, useRef, useState, useTransition } from 'react'
import { checkoutContent as content } from '@/data/checkout'
import { captureContactAction, checkoutAction } from '@/lib/cart-actions'
import { readDraft, writeDraft } from '@/lib/checkout-draft'
import { type CheckoutFormState, NEW_ADDRESS, prefillCheckout } from '@/lib/checkout-form-state'
import {
  checkoutTotals,
  deliveryLine,
  isDigitalOnly,
  offeredMethods,
  takesUpi,
} from '@/lib/checkout-preview'
import { type CheckoutStep, type GateState, type StepGates, stepsFor } from '@/lib/checkout-steps'
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
import { useCheckoutStep } from '@/lib/use-checkout-step'

export type CheckoutFormInput = {
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
 * Everything the stepped checkout knows and does, so `CheckoutForm` and its step panels
 * only draw. Every amount here is a preview; `checkoutAction` and `placeOrder` re-check and
 * re-price everything on the server.
 */
export function useCheckoutForm(input: CheckoutFormInput) {
  const { cart, methods, discount, settings } = input
  const customer = input.customer ?? null
  const addresses = input.addresses ?? []
  const deposit = input.deposit ?? NO_DEPOSIT
  const emiMinPaise = input.emiMinPaise ?? null

  const [pending, start] = useTransition()
  const [checking, startCheck] = useTransition()
  const [form, setForm] = useState<CheckoutFormState>(() => ({
    ...prefillCheckout(customer, addresses[0]),
    payment: offeredMethods(cart, methods)[0]?.id ?? 'cod',
  }))
  const [savedId, setSavedId] = useState<string>(addresses[0]?.id ?? NEW_ADDRESS)
  const [business, setBusiness] = useState(false)
  const [shipping, setShipping] = useState<CheckoutShipping | null>(null)
  /** The courier has answered (or failed to) for the PIN code on screen. */
  const [quoted, setQuoted] = useState(false)
  const [rateId, setRateId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [giftCards, setGiftCards] = useState<AppliedGiftCard[]>([])
  const [touched, setTouched] = useState<Partial<Record<CheckoutFieldKey, true>>>({})
  const [attempted, setAttempted] = useState(false)
  const [expressNote, setExpressNote] = useState<string | null>(null)
  /** The tab's saved draft has been read back; until then the gates only know the prefill. */
  const [settled, setSettled] = useState(false)
  /** A field to focus once its step is on screen (Pay found something to fix). */
  const focusNext = useRef<CheckoutFieldKey | null>(null)

  /** Ask the courier as soon as six digits are in; the server re-checks on submit regardless. */
  const checkPincode = (raw: string, stateCode: string) => {
    setShipping(null)
    setQuoted(false)
    const pincode = cleanPincode(raw)
    if (isDigitalOnly(cart) || !isFullPincode(pincode)) return
    startCheck(async () => {
      const next = await checkoutShippingAction({ pincode, stateCode })
      setShipping(next)
      setQuoted(true)
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

  // Read back this tab's draft (a reload keeps the details and the step), then quote the
  // address the page opened with: the draft's, or the account's prefilled one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, on mount.
  useEffect(() => {
    const draft = readDraft(cart.id)
    let opened = form
    if (draft) {
      opened = {
        ...draft.form,
        // A signed-in shopper's email is theirs; the payment pick must still be on offer.
        email: customer?.email ?? draft.form.email,
        payment: methods.some((m) => m.id === draft.form.payment)
          ? draft.form.payment
          : form.payment,
      }
      setForm(opened)
      setSavedId(addresses.some((a) => a.id === draft.savedId) ? draft.savedId : NEW_ADDRESS)
      setBusiness(draft.business)
      setRateId(draft.rateId)
    }
    if (isFullPincode(opened.pincode)) checkPincode(opened.pincode, opened.stateCode)
    setSettled(true)
  }, [])
  useEffect(() => {
    if (settled) writeDraft(cart.id, { form, savedId, business, rateId })
  }, [settled, cart.id, form, savedId, business, rateId])
  // A code applied in the summary can move the cart across a band or make shipping free.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-quote only when the discount changes.
  useEffect(() => {
    if (settled && isFullPincode(form.pincode)) checkPincode(form.pincode, form.stateCode)
  }, [discount?.amountPaise, discount?.freeShipping])

  const fieldErrors = checkoutFieldErrors(form, {
    emailRequired: settings.email === 'required' || Boolean(customer?.email),
    gstin: business,
  })
  const shownErrors = attempted
    ? fieldErrors
    : Object.fromEntries(
        Object.entries(fieldErrors).filter(([k]) => touched[k as CheckoutFieldKey]),
      )
  const wrongFields = fieldOrder(settings.pincodeFirst).filter((k) => fieldErrors[k])
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
  const { digitalOnly, offered, payment, coveredByCards, payNowPaise } = totals
  const delivery = shipping?.delivery
  const unserviceable =
    (delivery?.ok === true && !delivery.serviceable) || shipping?.rates.kind === 'none'
  const shippingGate: GateState = digitalOnly
    ? 'ok'
    : unserviceable
      ? 'blocked'
      : checking || !quoted
        ? 'pending'
        : shipping?.rates.kind === 'free' || rate
          ? 'ok'
          : 'blocked'
  const gates: StepGates = {
    address: wrongFields.length === 0 ? 'ok' : 'blocked',
    shipping: shippingGate,
  }
  const steps = stepsFor(digitalOnly)
  const { step, go } = useCheckoutStep(steps, gates, settled)

  // Pay found a field to fix on an earlier step: focus it once that step is on screen.
  useEffect(() => {
    const key = focusNext.current
    if (step !== 'address' || !key) return
    focusNext.current = null
    document.getElementById(fieldId(key))?.focus()
  }, [step])

  const set =
    (k: keyof CheckoutFormState): ChangeHandler =>
    (e) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }))
  const touch = (k: CheckoutFieldKey) =>
    setTouched((prev) => (prev[k] ? prev : { ...prev, [k]: true }))
  /** Point at the first field that needs fixing, on the address step. */
  const showFirstWrong = (): void => {
    setAttempted(true)
    setError(null)
    const first = wrongFields[0]
    if (!first) return
    if (step === 'address') document.getElementById(fieldId(first))?.focus()
    else {
      focusNext.current = first
      go({ type: 'goto', step: 'address' })
    }
  }
  /** Place the order with this way to pay, or point at the first field that needs fixing. */
  const submit = (paymentId: string): boolean => {
    if (wrongFields.length > 0) {
      showFirstWrong()
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

  /** A PIN code whose prefix allows one state fills it in, unless the shopper picked one. */
  const handlePincode = (pincode: string) => {
    const guess = touched.stateCode ? null : stateForPincode(cleanPincode(pincode))
    const stateCode = guess ?? form.stateCode
    setForm((prev) => ({ ...prev, pincode, stateCode }))
    checkPincode(pincode, stateCode)
  }
  /** Zones can be drawn by state, so a new state re-prices shipping. */
  const handleState = (stateCode: string) => {
    setForm((prev) => ({ ...prev, stateCode }))
    touch('stateCode')
    checkPincode(form.pincode, stateCode)
  }
  /** PIN code first: the directory's city and state, still editable; shipping re-quotes for the state. */
  const handlePlace = (place: { city: string; stateCode: string }, pincode: string) => {
    setForm((prev) => ({ ...prev, city: place.city, stateCode: place.stateCode }))
    if (place.stateCode !== form.stateCode) checkPincode(pincode, place.stateCode)
  }
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
  const handlePayment = (id: string) => setForm((prev) => ({ ...prev, payment: id }))
  const handlePhone = (phone: string) => setForm((prev) => ({ ...prev, phone }))
  /** Continue on the address step shows every check first; later steps wait at their gate. */
  const handleContinue = () => {
    if (step === 'address' && gates.address !== 'ok') {
      showFirstWrong()
      return
    }
    setError(null)
    go({ type: 'next' })
  }
  const handleBack = () => go({ type: 'back' })
  const handleGoto = (to: CheckoutStep) => go({ type: 'goto', step: to })
  /* Enter in a field continues; on the last step it pays. One form for the whole checkout. */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setExpressNote(null)
    if (step === steps[steps.length - 1]) submit(payment)
    else handleContinue()
  }
  /* Express UPI: pick the UPI method and pay at once when the details are in. */
  const handleExpress = () => {
    const upiMethod = offered.find(takesUpi)
    if (!upiMethod) return
    setForm((prev) => ({ ...prev, payment: upiMethod.id }))
    setExpressNote(submit(upiMethod.id) ? null : content.express.needDetails)
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

  const shortfall = totals.shortfallPaise
  const payNow = formatPaise(payNowPaise)
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

  return {
    ...input,
    customer,
    addresses,
    deposit,
    form,
    savedId,
    business,
    shipping,
    rates,
    rate,
    rateId,
    checking,
    pending,
    updating,
    error,
    expressNote,
    giftCards,
    shownErrors,
    toFix: attempted && step === 'address' ? wrongFields.length : 0,
    totals,
    payNow,
    payLabel,
    emiMonthly,
    shortfall,
    unserviceable,
    deliveryText: deliveryLine(shipping, checking),
    upi: offered.find(takesUpi) ?? null,
    steps,
    step,
    gates,
    set,
    handlePincode,
    handleState,
    handlePlace,
    handlePickAddress,
    handleLeave,
    handleBusiness,
    handlePayment,
    handlePhone,
    handleRate: setRateId,
    handleContinue,
    handleBack,
    handleGoto,
    handleSubmit,
    handleExpress,
    handleGiftCardApply,
    handleGiftCardRemove,
  }
}

export type CheckoutFormModel = ReturnType<typeof useCheckoutForm>
