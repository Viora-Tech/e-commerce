import { formatPaise } from '@commerce/blocks'
import type { CartView, CheckoutLook, SavedAddress, SignedInCustomer } from '@commerce/core'
import { type CheckoutSettings, stateForPincode } from '@commerce/core/checkout-settings'
import type {
  CheckoutAccountMode,
  LoginMethod,
  SignInOptions,
} from '@commerce/core/customer-accounts'
import { lowestEmiPaise } from '@commerce/core/emi'
import type { PolicyLink } from '@commerce/core/policies'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { checkoutContent as content } from '@/data/checkout'
import { deleteAddressAction, saveAddressAction } from '@/lib/account-actions'
import { captureContactAction, checkoutAction } from '@/lib/cart-actions'
import { readDraft, writeDraft } from '@/lib/checkout-draft'
import { type CheckoutFormState, NEW_ADDRESS, prefillCheckout } from '@/lib/checkout-form-state'
import {
  checkoutTotals,
  deliveryBy,
  deliveryLine,
  isDigitalOnly,
  offeredMethods,
  takesUpi,
} from '@/lib/checkout-preview'
import { readRemembered, writeRemembered } from '@/lib/checkout-remember'
import { bringIntoView, followLegacyStep } from '@/lib/checkout-scroll'
import {
  firstOpenSection,
  type SectionGates,
  sectionDomId,
  sectionsFor,
} from '@/lib/checkout-sections'
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
import { isFullPincode, useCheckoutShipping } from '@/lib/use-checkout-shipping'
import { applyPendingDiscountCode } from './pending-code'

/** Settings → Customer accounts, as the Contact card needs it. */
export type CheckoutSignIn = {
  /** Code methods the store can send, in order; never empty. */
  methods: LoginMethod[]
  /** `account_required`: the shopper signs in before anything else. */
  checkout: CheckoutAccountMode
  /** Providers, passkeys and the rest the store switched on. */
  options: SignInOptions | null
}

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
  /** How shoppers sign in here, and whether a guest may check out. */
  signIn?: CheckoutSignIn
}

type ChangeHandler = (
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
) => void

const NO_DEPOSIT: CartDepositTerms = { laterPaise: 0, nonRefundableDays: null }
const GUEST_EMAIL: CheckoutSignIn = { methods: ['email'], checkout: 'guest', options: null }
/** The Send code button in Contact; Pay points here until the shopper signs in. */
export const SEND_CODE_ID = 'checkout-send-code'
/** The Save button of an address being edited. */
export const SAVE_ADDRESS_ID = 'checkout-address-save'

/** What an address book entry needs before Save writes it. */
const ADDRESS_KEYS = ['pincode', 'name', 'line1', 'city', 'stateCode', 'phone'] as const
/** The fields the Contact card shows; every other field is the Delivery card's. */
const CONTACT_KEYS: readonly CheckoutFieldKey[] = ['email', 'phone']

/**
 * Everything the one-page checkout knows and does, so `CheckoutForm` and its cards only
 * draw. Every amount here is a preview; `checkoutAction` and `placeOrder` re-check and
 * re-price everything on the server.
 */
export function useCheckoutForm(input: CheckoutFormInput) {
  const { cart, methods, discount, settings } = input
  const customer = input.customer ?? null
  const addresses = input.addresses ?? []
  const deposit = input.deposit ?? NO_DEPOSIT
  const emiMinPaise = input.emiMinPaise ?? null
  const signIn = input.signIn ?? GUEST_EMAIL
  const router = useRouter()

  const [pending, start] = useTransition()
  const [savingAddress, startSave] = useTransition()
  const [form, setForm] = useState<CheckoutFormState>(() => ({
    ...prefillCheckout(customer, addresses[0]),
    payment: offeredMethods(cart, methods)[0]?.id ?? 'cod',
  }))
  const [savedId, setSavedId] = useState<string>(addresses[0]?.id ?? NEW_ADDRESS)
  const [business, setBusiness] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [giftCards, setGiftCards] = useState<AppliedGiftCard[]>([])
  const [touched, setTouched] = useState<Partial<Record<CheckoutFieldKey, true>>>({})
  const [attempted, setAttempted] = useState(false)
  const [expressNote, setExpressNote] = useState<string | null>(null)
  /**
   * Checking out as a guest (the plain contact fields) unless the store needs an account;
   * "Sign in" in the Contact card switches to the code.
   */
  const [guest, setGuest] = useState(signIn.checkout !== 'account_required')
  /** The saved address being edited in place, or null. */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addressError, setAddressError] = useState<string | null>(null)
  /** The tab's saved draft has been read back; until then the gates only know the prefill. */
  const [settled, setSettled] = useState(false)

  // The courier cannot collect cash here: move off cash on delivery to the first online method.
  const {
    checking,
    shipping,
    rates,
    rate,
    rateId,
    setRateId,
    routeKey,
    setRouteKey,
    insurance,
    toggleInsurance,
    deliveryChoice,
    unserviceable,
    checkPincode,
    gate,
  } = useCheckoutShipping(cart, () =>
    setForm((prev) =>
      prev.payment === 'cod'
        ? { ...prev, payment: methods.find((m) => m.id !== 'cod')?.id ?? prev.payment }
        : prev,
    ),
  )

  // Read back this tab's draft (a reload keeps the details), then quote the
  // address the page opened with: the draft's, or the account's prefilled one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, on mount.
  useEffect(() => {
    const stored = readDraft(cart.id)
    // Just signed in with nothing typed yet: the account's own address wins over the empty draft.
    const draft =
      stored && customer && addresses.length > 0 && !stored.form.line1.trim() ? null : stored
    if (stored) setGuest(stored.guest)
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
    } else if (!customer) {
      // A guest back on the same browser: start from the details they used last time.
      const remembered = readRemembered()
      if (remembered) {
        opened = { ...form, ...remembered }
        setForm(opened)
        setGuest(true)
      }
    }
    if (isFullPincode(opened.pincode)) checkPincode(opened.pincode, opened.stateCode)
    setSettled(true)
    followLegacyStep(sectionsFor(isDigitalOnly(cart)))
  }, [])
  useEffect(() => {
    if (!settled) return
    writeDraft(cart.id, { form, savedId, business, rateId, guest })
    if (!customer) writeRemembered(form)
  }, [settled, cart.id, form, savedId, business, rateId, guest, customer])
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
  const wrongFields = fieldOrder(true).filter((k) => fieldErrors[k])
  const accountRequired = signIn.checkout === 'account_required'
  /** Contact is settled: signed in, or a guest where the store allows one. */
  const contactReady = customer !== null || (!accountRequired && guest)
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
  const contactFieldsOk = !wrongFields.some((k) => CONTACT_KEYS.includes(k))
  const addressFieldsOk = !wrongFields.some((k) => !CONTACT_KEYS.includes(k) && k !== 'gstin')
  const gates: SectionGates = {
    contact: contactReady && contactFieldsOk ? 'ok' : 'blocked',
    address: contactReady && wrongFields.length === 0 && editingId === null ? 'ok' : 'blocked',
    shipping: gate,
  }
  const sections = sectionsFor(digitalOnly)
  /** Each card's own work, for the tick on its number; Delivery does not wait on Contact. */
  const done = {
    contact: gates.contact === 'ok',
    address: addressFieldsOk && editingId === null,
    shipping: gates.shipping === 'ok',
  }

  const set =
    (k: keyof CheckoutFormState): ChangeHandler =>
    (e) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }))
  const touch = (k: CheckoutFieldKey) =>
    setTouched((prev) => (prev[k] ? prev : { ...prev, [k]: true }))
  /**
   * Point at what stops the order: signing in (the mobile number, then Send code), the first
   * wrong field, or an address still being edited. Everything is on one page, so this only
   * scrolls to it and focuses it.
   */
  const showFirstWrong = (): void => {
    setAttempted(true)
    setError(null)
    const signInFirst = !contactReady
    const first = signInFirst && !fieldErrors.phone ? null : wrongFields[0]
    const target = first
      ? fieldId(first)
      : signInFirst
        ? SEND_CODE_ID
        : editingId
          ? SAVE_ADDRESS_ID
          : null
    if (target) bringIntoView(target)
  }
  /** Place the order with this way to pay, or point at the first field that needs fixing. */
  const submit = (paymentId: string): boolean => {
    if (gates.address !== 'ok') {
      showFirstWrong()
      return false
    }
    // Shipping is part of the price: the order goes with the option picked in Shipping, and
    // waits until there is one (the courier is still quoting, or nothing covers the address).
    if (firstOpenSection(gates, sections) === 'shipping') {
      if (gates.shipping === 'blocked') setError(content.errors.pickShipping)
      bringIntoView(sectionDomId('shipping'))
      return false
    }
    setError(null)
    const { label, ...details } = form
    start(async () => {
      const r = await checkoutAction({
        ...details,
        ...(label ? { label } : {}),
        pincode: cleanPincode(form.pincode),
        payment: paymentId,
        giftCards: giftCards.map((c) => c.code),
        ...(rateId ? { shippingRate: rateId } : {}),
        ...(deliveryChoice ? { deliveryQuote: deliveryChoice } : {}),
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
    setEditingId(null)
    setAddressError(null)
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
  const handleGuest = (on: boolean) => {
    setGuest(on)
    setAttempted(false)
  }
  /** Edit a saved address in place: its values fill the fields, Save writes the address book. */
  const handleEdit = (id: string) => {
    handlePickAddress(id)
    setEditingId(id)
  }
  /** Leave the edit (or the new address form) and go back to a saved address. */
  const handleCancelAddress = () => {
    const back = addresses.find((a) => a.id === editingId) ?? addresses[0]
    if (back) handlePickAddress(back.id)
    else setEditingId(null)
  }
  const handleSaveAddress = () => {
    if (!editingId) return
    const wrong = ADDRESS_KEYS.find((k) => fieldErrors[k])
    if (wrong) {
      setAttempted(true)
      document.getElementById(fieldId(wrong))?.focus()
      return
    }
    setAddressError(null)
    const id = editingId
    startSave(async () => {
      const r = await saveAddressAction(id, {
        name: form.name,
        line1: form.line1,
        line2: form.line2,
        city: form.city,
        stateCode: form.stateCode,
        pincode: cleanPincode(form.pincode),
        phone: form.phone,
        label: form.label || null,
      })
      if (!r.ok) {
        setAddressError(content.addressBook.saveFailed)
        return
      }
      setEditingId(null)
      router.refresh()
    })
  }
  const handleDeleteAddress = (id: string) => {
    startSave(async () => {
      await deleteAddressAction(id)
      if (savedId === id) handlePickAddress(addresses.find((a) => a.id !== id)?.id ?? NEW_ADDRESS)
      router.refresh()
    })
  }
  const handleLabel = (label: string) => setForm((prev) => ({ ...prev, label }))
  const handlePayment = (id: string) => setForm((prev) => ({ ...prev, payment: id }))
  const handlePhone = (phone: string) => setForm((prev) => ({ ...prev, phone }))
  /* Enter in a field pays, like the Pay button. One form for the whole checkout. */
  // A code typed but never applied is applied first; the shopper checks the new total (pending-code.ts).
  const applyTypedCode = () =>
    applyPendingDiscountCode((code) => setError(content.errors.discountNotApplied(code)))
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setExpressNote(null)
    if (applyTypedCode()) return
    submit(payment)
  }
  /*
   * Express UPI: pick the UPI method and pay at once with the shipping option picked in
   * Shipping (the cheapest until the shopper changes it), or point at what is missing.
   */
  const handleExpress = () => {
    const upiMethod = offered.find(takesUpi)
    if (!upiMethod || applyTypedCode()) return
    setForm((prev) => ({ ...prev, payment: upiMethod.id }))
    const placed = submit(upiMethod.id)
    setExpressNote(
      placed
        ? null
        : gates.address === 'ok'
          ? content.express.needShipping
          : content.express.needDetails,
    )
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
    // Paying on delivery ships Standard's COD route, at its own price (Delivery options app).
    rate:
      totals.payment === 'cod' && rate?.delivery?.codPricePaise != null
        ? { ...rate, pricePaise: rate.delivery.codPricePaise }
        : rate,
    rateId,
    routeKey,
    insurance,
    checking,
    pending,
    updating,
    error,
    expressNote,
    signIn,
    accountRequired,
    contactReady,
    guest,
    editingId,
    savingAddress,
    addressError,
    giftCards,
    shownErrors,
    toFix: attempted && contactReady ? wrongFields.length : 0,
    /** Pay was pressed before the contact was settled (signed in, or a guest). */
    needsContact: attempted && !contactReady,
    totals,
    payNow,
    payLabel,
    emiMonthly,
    shortfall,
    unserviceable,
    deliveryText: deliveryLine(shipping, checking),
    /** "Thu, 29 Oct": the latest day the picked option arrives, for the PIN code line. */
    deliveryBy: deliveryBy(shipping, rate),
    upi: offered.find(takesUpi) ?? null,
    sections,
    gates,
    done,
    set,
    handlePincode,
    handleState,
    handlePlace,
    handlePickAddress,
    handleLeave,
    handleBusiness,
    handlePayment,
    handlePhone,
    handleGuest,
    handleEdit,
    handleCancelAddress,
    handleSaveAddress,
    handleDeleteAddress,
    handleLabel,
    handleRate: setRateId,
    handleRoute: setRouteKey,
    handleInsurance: toggleInsurance,
    handleSubmit,
    handleExpress,
    handleGiftCardApply,
    handleGiftCardRemove,
  }
}

export type CheckoutFormModel = ReturnType<typeof useCheckoutForm>
