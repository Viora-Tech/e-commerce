import { isAbroad } from '@commerce/core/checkout-address'
import { applyCheckoutText, stateForPincode } from '@commerce/core/checkout-settings'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { checkoutContent as content } from '@/data/checkout'
import { captureContactAction, checkoutAction } from '@/lib/cart-actions'
import { addressBookHandlers } from '@/lib/checkout-address-book'
import { readDraft, writeDraft } from '@/lib/checkout-draft'
import {
  addressForCountry,
  type CheckoutFormState,
  fullNameOf,
  NEW_ADDRESS,
  phoneForCountry,
  prefillCheckout,
} from '@/lib/checkout-form-state'
import {
  newAddressForm,
  offCod,
  openFromDraft,
  openFromRemembered,
  orderDetails,
} from '@/lib/checkout-opening'
import {
  checkoutTotals,
  deliveryBy,
  deliveryLine,
  isDigitalOnly,
  offeredMethods,
  payView,
  takesUpi,
} from '@/lib/checkout-preview'
import { readRemembered, writeRemembered } from '@/lib/checkout-remember'
import { bringIntoView, followLegacyStep, pressSendCode } from '@/lib/checkout-scroll'
import {
  type CheckoutSection,
  firstOpenSection,
  type SectionGates,
  sectionDomId,
  sectionsFor,
} from '@/lib/checkout-sections'
import { fieldsOnStep, stepMove } from '@/lib/checkout-step-move'
import {
  type CheckoutFieldKey,
  checkoutFieldErrors,
  cleanPincode,
  fieldId,
  fieldOrder,
} from '@/lib/checkout-validation'
import { isQuotable, useCheckoutShipping } from '@/lib/use-checkout-shipping'
import { useCheckoutTender } from '@/lib/use-checkout-tender'
import { useHeldStep } from '@/lib/use-held-step'
import {
  type ChangeHandler,
  type CheckoutFormInput,
  CONTACT_KEYS,
  GUEST_EMAIL,
  INDIA_ONLY,
  NO_DEPOSIT,
  PLACE_KEYS,
  SAVE_ADDRESS_ID,
  SEND_CODE_ID,
} from './checkout-form-input'
import { applyPendingDiscountCode } from './pending-code'

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
  const countries = input.countries?.length ? input.countries : INDIA_ONLY
  /** A country the picker offers; anything else (an old draft) is India. */
  const offeredCountry = (code: string | undefined) =>
    code && countries.includes(code) ? code : 'IN'
  const startCountry = offeredCountry(input.defaultCountry)
  /** Settings → Checkout → Form fields (#154). */
  const splitName = settings.fields.name === 'split'
  const companyShown = settings.fields.company !== 'hidden'
  /** Our checkout words with the store's own wording over them (#158). */
  const copy = applyCheckoutText(content, input.text ?? {})
  const router = useRouter()

  const [pending, start] = useTransition()
  const [savingAddress, startSave] = useTransition()
  const [form, setForm] = useState<CheckoutFormState>(() => ({
    ...prefillCheckout(customer, addresses[0], settings.fields.name, startCountry),
    payment: offeredMethods(cart, methods)[0]?.id ?? 'cod',
  }))
  const [savedId, setSavedId] = useState<string>(addresses[0]?.id ?? NEW_ADDRESS)
  const [business, setBusiness] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tender = useCheckoutTender(methods, setForm, customer !== null, input.storeCreditPaise)
  const { giftCards } = tender
  const [touched, setTouched] = useState<Partial<Record<CheckoutFieldKey, true>>>({})
  const [attempted, setAttempted] = useState(false)
  const [expressNote, setExpressNote] = useState<string | null>(null)
  /** The step the shopper chose; until then, the first one that still needs something. */
  const [pickedStep, setPickedStep] = useState<CheckoutSection | null>(null)
  /**
   * Signing in with a code comes first, every time; a guest link leads to the contact fields.
   */
  const [guest, setGuest] = useState(false)
  /** The saved address being edited in place, or null. */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addressError, setAddressError] = useState<string | null>(null)
  /** The tab's saved draft has been read back; until then the gates only know the prefill. */
  const [settled, setSettled] = useState(false)

  // The courier cannot collect cash here: move off cash on delivery to the first online method.
  const ship = useCheckoutShipping(cart, () => setForm((prev) => offCod(prev, methods)))
  const { checking, shipping, rates, rate, rateId, setRateId, unserviceable, checkPincode } = ship

  // Read back this tab's draft, then quote the address the page opened with.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, on mount.
  useEffect(() => {
    const stored = readDraft(cart.id)
    // Just signed in with nothing typed yet: the account's own address wins over the empty draft.
    const draft =
      stored && customer && addresses.length > 0 && !stored.form.line1.trim() ? null : stored
    let opened = form
    if (draft) {
      opened = openFromDraft(draft.form, form, {
        email: customer?.email,
        countryCode: offeredCountry(draft.form.countryCode),
        payments: methods.map((m) => m.id),
      })
      setForm(opened)
      setSavedId(addresses.some((a) => a.id === draft.savedId) ? draft.savedId : NEW_ADDRESS)
      setBusiness(draft.business)
      setRateId(draft.rateId)
    } else if (!customer) {
      // A guest back on the same browser: start from the details they used last time.
      const remembered = readRemembered()
      if (remembered) {
        opened = openFromRemembered(remembered, form, offeredCountry(remembered.countryCode))
        setForm(opened)
      }
    }
    if (isQuotable(opened.pincode, opened.countryCode)) {
      checkPincode(opened.pincode, opened.stateCode, opened.countryCode)
    }
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
    if (settled && isQuotable(form.pincode, form.countryCode)) {
      checkPincode(form.pincode, form.stateCode, form.countryCode)
    }
  }, [discount?.amountPaise, discount?.freeShipping])

  const fieldErrors = checkoutFieldErrors(form, {
    emailRequired: settings.email === 'required' || Boolean(customer?.email),
    gstin: business,
    fields: settings.fields,
  })
  const shownErrors = attempted
    ? fieldErrors
    : Object.fromEntries(
        Object.entries(fieldErrors).filter(([k]) => touched[k as CheckoutFieldKey]),
      )
  const abroad = isAbroad(form.countryCode)
  const wrongFields = fieldOrder(!abroad).filter((k) => fieldErrors[k])
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
    methodRules: input.methodRules,
    abroad,
    storeCreditPaise: tender.spendablePaise,
  })
  const { digitalOnly, offered, payment, coveredByCards, payNowPaise } = totals
  const contactFieldsOk = !wrongFields.some((k) => CONTACT_KEYS.includes(k))
  const addressFieldsOk = !wrongFields.some((k) => !CONTACT_KEYS.includes(k) && k !== 'gstin')
  const gates: SectionGates = {
    contact: contactReady && contactFieldsOk ? 'ok' : 'blocked',
    address: contactReady && wrongFields.length === 0 && editingId === null ? 'ok' : 'blocked',
    shipping: ship.gate,
  }
  const sections = sectionsFor(digitalOnly)
  const step = useHeldStep(pickedStep, gates, sections)
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
   * wrong field, or an address still being edited. Opens its step, then scrolls to it and
   * focuses it once the step is on screen.
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
    const home = signInFirst || (first && CONTACT_KEYS.includes(first)) ? 'contact' : 'address'
    setPickedStep(home)
    if (target) requestAnimationFrame(() => bringIntoView(target))
  }
  /** The first touch of a field holds the step, so it never moves on by itself. */
  const handleStayOnStep = () => setPickedStep((picked) => picked ?? step)
  const handleContinue = () => {
    const move = stepMove({ step, sections, done, shipping: gates.shipping })
    if (move.kind === 'pick-shipping') setError(content.errors.pickShipping)
    if (move.kind === 'fix' && (contactReady || !pressSendCode(SEND_CODE_ID))) showFirstWrong()
    if (move.kind !== 'next') return
    setError(null)
    setAttempted(false)
    if (move.to) setPickedStep(move.to)
    requestAnimationFrame(() => window.scrollTo({ top: 0 }))
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
      setPickedStep('shipping')
      requestAnimationFrame(() => bringIntoView(sectionDomId('shipping')))
      return false
    }
    setError(null)
    start(async () => {
      const r = await checkoutAction({
        ...orderDetails(form, { splitName, abroad }),
        payment: paymentId,
        giftCards: giftCards.map((c) => c.code),
        useStoreCredit: tender.spendablePaise > 0 && !digitalOnly,
        ...ship.formFields,
      })
      if (r?.error) setError(r.error)
    })
    return true
  }

  /** A PIN code whose prefix allows one state fills it in, unless the shopper picked one. */
  const handlePincode = (pincode: string) => {
    if (abroad) {
      // A postcode abroad fills nothing in; its country zone prices it.
      setForm((prev) => ({ ...prev, pincode }))
      checkPincode(pincode, form.stateCode, form.countryCode)
      return
    }
    const guess = touched.stateCode ? null : stateForPincode(cleanPincode(pincode))
    const stateCode = guess ?? form.stateCode
    setForm((prev) => ({ ...prev, pincode, stateCode }))
    checkPincode(pincode, stateCode)
  }
  /** Zones can be drawn by state, so a new state re-prices shipping. */
  const handleState = (stateCode: string) => {
    setForm((prev) => ({ ...prev, stateCode }))
    touch('stateCode')
    // Abroad the region is typed: zones there go by country, so nothing re-prices.
    if (!abroad) checkPincode(form.pincode, stateCode)
  }
  /**
   * A new country empties the address's place fields (a PIN code is not a postcode) and
   * quotes again; cash on delivery moves to the first online method outside India.
   */
  const handleCountry = (countryCode: string) => {
    const next = addressForCountry(offeredCountry(countryCode))
    const online = methods.find((m) => m.id !== 'cod')?.id
    setForm((prev) => ({
      ...prev,
      ...next,
      phone: phoneForCountry(prev.phone, next.countryCode),
      payment:
        isAbroad(next.countryCode) && prev.payment === 'cod' && online ? online : prev.payment,
    }))
    setTouched((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => !PLACE_KEYS.includes(k))),
    )
    checkPincode(next.pincode, next.stateCode, next.countryCode)
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
    const blank = prefillCheckout(customer, undefined, settings.fields.name, startCountry)
    const next = picked
      ? prefillCheckout(customer, picked, settings.fields.name)
      : newAddressForm(blank, form, { splitName, country: startCountry })
    setForm((prev) => ({ ...prev, ...next }))
    checkPincode(next.pincode, next.stateCode, next.countryCode)
  }
  /* Leaving a field shows its check; leaving the contact saves it, so a basket left here can be recovered. */
  const handleLeave = (key: CheckoutFieldKey) => {
    touch(key)
    if (key !== 'email' && key !== 'phone') return
    if (!form.email.includes('@') && form.phone.replace(/\D/g, '').length < 10) return
    void captureContactAction({ email: form.email, phone: form.phone, name: fullNameOf(form) })
  }
  const handleBusiness = (on: boolean) => {
    setBusiness(on)
    // A company name typed in Delivery (#154) stays when the GST box is unticked.
    if (!on) {
      setForm((prev) => ({
        ...prev,
        gstin: '',
        businessName: companyShown ? prev.businessName : '',
      }))
    }
  }
  const handleMarketing = (channel: 'email' | 'whatsapp', on: boolean) =>
    setForm((prev) => ({
      ...prev,
      marketing: { email: false, whatsapp: false, ...prev.marketing, [channel]: on },
    }))
  const handleGuest = (on: boolean) => {
    setGuest(on)
    setAttempted(false)
  }
  const { handleEdit, handleCancelAddress, handleSaveAddress, handleDeleteAddress } =
    addressBookHandlers({
      addresses,
      editingId,
      setEditingId,
      savedId,
      form,
      fieldErrors,
      setAttempted,
      setAddressError,
      startSave,
      pickAddress: handlePickAddress,
      refresh: () => router.refresh(),
    })
  const handleLabel = (label: string) => setForm((prev) => ({ ...prev, label }))
  const handlePayment = (id: string) => setForm((prev) => ({ ...prev, payment: id }))
  const handlePhone = (phone: string) => setForm((prev) => ({ ...prev, phone }))
  /* Enter in a field moves on or pays, like the button. One form for the whole checkout. */
  // A code typed but never applied is applied first; the shopper checks the new total (pending-code.ts).
  const applyTypedCode = () =>
    applyPendingDiscountCode((code) => setError(content.errors.discountNotApplied(code)))
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setExpressNote(null)
    if (applyTypedCode()) return
    if (step !== 'payment') {
      handleContinue()
      return
    }
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
  const shortfall = totals.shortfallPaise
  const updating = checking && !digitalOnly
  const { payNow, emiMonthly, payLabel } = payView(payNowPaise, {
    emiMinPaise,
    coveredByCards,
    cod: payment === 'cod',
    placeOrder: copy.placeOrder,
  })

  return {
    ...input,
    copy,
    customer,
    addresses,
    deposit,
    form,
    savedId,
    business,
    shipping,
    rates,
    rate,
    deliveryApp: { ...ship.app, rateId },
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
    storeCredit: tender.storeCredit,
    shownErrors,
    toFix: attempted && contactReady ? fieldsOnStep(wrongFields, CONTACT_KEYS, step) : 0,
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
    step,
    gates,
    done,
    countries,
    abroad,
    /** Enough of the address to quote shipping (six PIN digits, or a postcode that will do). */
    addressQuotable: isQuotable(form.pincode, form.countryCode),
    set,
    handlePincode,
    handleState,
    handleCountry,
    handlePlace,
    handlePickAddress,
    handleLeave,
    handleBusiness,
    handleMarketing,
    handlePayment,
    handlePhone,
    handleGuest,
    handleEdit,
    handleCancelAddress,
    handleSaveAddress,
    handleDeleteAddress,
    handleLabel,
    handleRate: setRateId,
    handleSubmit,
    handleStep: setPickedStep,
    handleStayOnStep,
    handleExpress,
    handleGiftCardApply: tender.handleGiftCardApply,
    handleGiftCardRemove: tender.handleGiftCardRemove,
    handleStoreCredit: tender.handleStoreCredit,
  }
}

export type CheckoutFormModel = ReturnType<typeof useCheckoutForm>
