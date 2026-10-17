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
import { useEffect, useRef, useState, useTransition } from 'react'
import { checkoutContent as content } from '@/data/checkout'
import { deleteAddressAction, saveAddressAction } from '@/lib/account-actions'
import { captureContactAction, checkoutAction } from '@/lib/cart-actions'
import { readDraft, writeDraft } from '@/lib/checkout-draft'
import { type CheckoutFormState, NEW_ADDRESS, prefillCheckout } from '@/lib/checkout-form-state'
import { checkoutTotals, deliveryLine, offeredMethods, takesUpi } from '@/lib/checkout-preview'
import { type CheckoutStep, type StepGates, stepsFor } from '@/lib/checkout-steps'
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
import { useCheckoutStep } from '@/lib/use-checkout-step'

/** Settings → Customer accounts, as the contact step needs it. */
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
/** The Send code button of the contact step; Continue points here until the shopper signs in. */
export const SEND_CODE_ID = 'checkout-send-code'
/** The Save button of an address being edited. */
export const SAVE_ADDRESS_ID = 'checkout-address-save'

/** What an address book entry needs before Save writes it. */
const ADDRESS_KEYS = ['pincode', 'name', 'line1', 'city', 'stateCode', 'phone'] as const
/** The fields the Contact step shows; every other field is the Address step's. */
const CONTACT_KEYS: readonly CheckoutFieldKey[] = ['email', 'phone']
const stepOfField = (key: CheckoutFieldKey): CheckoutStep =>
  CONTACT_KEYS.includes(key) ? 'contact' : 'address'

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
  /** The shopper skipped the code and checks out as a guest (when the store allows it). */
  const [guest, setGuest] = useState(false)
  /** The saved address being edited in place, or null. */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addressError, setAddressError] = useState<string | null>(null)
  /** The tab's saved draft has been read back; until then the gates only know the prefill. */
  const [settled, setSettled] = useState(false)
  /** A field to focus once its step is on screen (Pay found something to fix). */
  const focusNext = useRef<CheckoutFieldKey | null>(null)

  // The courier cannot collect cash here: move off cash on delivery to the first online method.
  const { checking, shipping, rates, rate, rateId, setRateId, unserviceable, checkPincode, gate } =
    useCheckoutShipping(cart, () =>
      setForm((prev) =>
        prev.payment === 'cod'
          ? { ...prev, payment: methods.find((m) => m.id !== 'cod')?.id ?? prev.payment }
          : prev,
      ),
    )

  // Read back this tab's draft (a reload keeps the details and the step), then quote the
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
    }
    if (isFullPincode(opened.pincode)) checkPincode(opened.pincode, opened.stateCode)
    setSettled(true)
  }, [])
  useEffect(() => {
    if (settled) writeDraft(cart.id, { form, savedId, business, rateId, guest })
  }, [settled, cart.id, form, savedId, business, rateId, guest])
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
  const gates: StepGates = {
    contact: contactReady && !wrongFields.some((k) => CONTACT_KEYS.includes(k)) ? 'ok' : 'blocked',
    address: contactReady && wrongFields.length === 0 && editingId === null ? 'ok' : 'blocked',
    shipping: gate,
  }
  const steps = stepsFor(digitalOnly)
  const { step, go } = useCheckoutStep(steps, gates, settled)

  // Pay found a field to fix on an earlier step: focus it once that step is on screen.
  useEffect(() => {
    const key = focusNext.current
    if (!key || stepOfField(key) !== step) return
    focusNext.current = null
    document.getElementById(fieldId(key))?.focus()
  }, [step])

  const set =
    (k: keyof CheckoutFormState): ChangeHandler =>
    (e) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }))
  const touch = (k: CheckoutFieldKey) =>
    setTouched((prev) => (prev[k] ? prev : { ...prev, [k]: true }))
  /**
   * Point at what stops the address step: signing in (the mobile number, then Send code),
   * the first wrong field, or an address still being edited.
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
    if (!target) return
    // Signing in and the contact fields live on the Contact step; every other fix on Address.
    const home: CheckoutStep = first ? stepOfField(first) : signInFirst ? 'contact' : 'address'
    if (step === home) document.getElementById(target)?.focus()
    else {
      if (first) focusNext.current = first
      go({ type: 'goto', step: home })
    }
  }
  /** Place the order with this way to pay, or point at the first field that needs fixing. */
  const submit = (paymentId: string): boolean => {
    if (gates.address !== 'ok') {
      showFirstWrong()
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
  /** Continue on the contact and address steps shows every check first; later steps wait at their gate. */
  const handleContinue = () => {
    // Not signed in yet: Continue (and Enter) press the contact step's Send code / Verify.
    const send = document.getElementById(SEND_CODE_ID)
    if (step === 'contact' && !contactReady) {
      if (send instanceof HTMLButtonElement && !send.disabled) send.click()
      else showFirstWrong()
      return
    }
    if (step === 'contact' && gates.contact !== 'ok') {
      showFirstWrong()
      return
    }
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
    signIn,
    accountRequired,
    contactReady,
    guest,
    editingId,
    savingAddress,
    addressError,
    giftCards,
    shownErrors,
    toFix:
      attempted && contactReady && (step === 'contact' || step === 'address')
        ? wrongFields.filter((k) => stepOfField(k) === step).length
        : 0,
    /** Continue was pressed before the contact step was settled. */
    needsContact: attempted && step === 'contact' && !contactReady,
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
    handleGuest,
    handleEdit,
    handleCancelAddress,
    handleSaveAddress,
    handleDeleteAddress,
    handleLabel,
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
