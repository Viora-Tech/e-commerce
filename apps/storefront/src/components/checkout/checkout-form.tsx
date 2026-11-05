'use client'

import { formatPaise } from '@commerce/blocks'
import CheckoutAddressBook from '@/components/checkout/checkout-address-book'
import CheckoutAgreement from '@/components/checkout/checkout-agreement'
import CheckoutCard from '@/components/checkout/checkout-card'
import CheckoutContact from '@/components/checkout/checkout-contact'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import CheckoutPageShell from '@/components/checkout/checkout-page-shell'
import CheckoutPayButton from '@/components/checkout/checkout-pay-button'
import CheckoutPayNote from '@/components/checkout/checkout-pay-note'
import CheckoutPaymentStep from '@/components/checkout/checkout-payment-step'
import CheckoutReview from '@/components/checkout/checkout-review'
import CheckoutSoldOut from '@/components/checkout/checkout-sold-out'
import CheckoutStepper from '@/components/checkout/checkout-stepper'
import CheckoutSummary from '@/components/checkout/checkout-summary'
import CheckoutTrust from '@/components/checkout/checkout-trust'
import DeliveryMethod from '@/components/checkout/delivery-method'
// Express checkout is off for now: see the comment above the Contact card.
// import ExpressPay from '@/components/checkout/express-pay'
import SummaryDisclosure from '@/components/checkout/summary-disclosure'
import { checkoutContent as content } from '@/data/checkout'
import { CK_BUTTON_PRIMARY, CK_LINK } from '@/lib/checkout-classes'
import { countryName } from '@/lib/checkout-countries'
import { reviewRows } from '@/lib/checkout-filled-rows'
import type { CheckoutFormInput } from '@/lib/checkout-form-input'
import { processorNames, shippingRow } from '@/lib/checkout-preview'
import {
  type CheckoutSection,
  nextSection,
  sectionDomId,
  sectionHeadingId,
} from '@/lib/checkout-sections'
import { cleanPincode } from '@/lib/checkout-validation'
import { useCheckoutForm } from '@/lib/use-checkout-form'
import { useCheckoutGst } from '@/lib/use-checkout-gst'

type CheckoutFormProps = CheckoutFormInput

const FORM_ID = 'checkout-form'

/**
 * The checkout (Figma: Checkout · Polish): one step on screen at a time, Contact, Delivery,
 * Shipping, Payment, with what is already done as rows above it and the order summary on the
 * right from `lg` (a fold-out card at the top on a phone). Pay sits in the summary card and waits
 * for the last step; on a phone the bottom bar carries Continue, then Pay. One form for the whole
 * checkout (#224): the hidden steps stay mounted, so every field goes with the order. The logic
 * is `useCheckoutForm`, and the server re-checks and re-prices everything on Pay.
 */
export default function CheckoutForm(props: CheckoutFormProps) {
  // Hooks
  const ck = useCheckoutForm(props)
  const gstPaise = useCheckoutGst({
    totalPaise: ck.totals.totalPaise,
    reductionPaise: (ck.discount?.amountPaise ?? 0) + Math.max(0, -ck.totals.adjustmentPaise),
    stateCode: ck.form.stateCode || null,
    abroad: ck.abroad,
  })

  // Helpers
  const stepLabel = (s: CheckoutSection): string =>
    s === 'address' && ck.totals.digitalOnly
      ? ck.copy.sections.detailsLabel
      : ck.copy.sections.label[s]

  // Render logic
  // The store's own wording over ours (#158).
  const copy = ck.copy.sections
  // const express = ck.copy.express
  const { totals, deposit, look, shipping, rate, sections, step } = ck
  const { digitalOnly } = totals
  const pincode = cleanPincode(ck.form.pincode)
  // Abroad there is no PIN code line: Shipping names the country instead.
  const fullPincode = !ck.abroad && /^[1-9]\d{5}$/.test(pincode)
  const soldOut = ck.cart.lines.filter((l) => !l.preorder && !l.giftCard && l.available < 1)
  const shippingPlace = ck.abroad
    ? countryName(ck.form.countryCode)
    : fullPincode
      ? [pincode, ck.form.city.trim()].filter(Boolean).join(', ')
      : null
  const shortfall =
    ck.shortfall > 0
      ? content.minimumOrder(formatPaise(ck.settings.minimumOrderPaise), formatPaise(ck.shortfall))
      : null
  const error =
    ck.error ??
    (ck.needsContact
      ? ck.accountRequired
        ? content.otp.needSignInRequired
        : content.otp.needSignIn
      : ck.toFix > 0
        ? content.validation.fixFields(ck.toFix)
        : null)
  /* Express checkout is off for now.
  // Express pays with the option picked in Shipping, so its line names that option and price.
  const expressLine = digitalOnly
    ? express.totalOnly(ck.payNow)
    : shipping?.rates.kind === 'free'
      ? express.total(ck.payNow, express.freeShipping)
      : rate
        ? express.total(
            ck.payNow,
            express.shippingLine(
              rate.name || content.delivery.standard,
              rate.pricePaise === 0 ? content.shippingFree : formatPaise(rate.pricePaise),
            ),
          )
        : express.noShippingYet
  const showExpress = ck.upi !== null && !totals.coveredByCards
  */
  // No way to pay left (a payment rule hid the only one): nothing for Place order to do.
  const noWayToPay = !totals.coveredByCards && totals.offered.length === 0
  const payDisabled = ck.unserviceable || ck.shortfall > 0 || noWayToPay
  // Cash on delivery or a transfer to the shop: no gateway takes a card or UPI PIN, so no note.
  const offline = totals.offered.every((m) => m.id === 'cod' || m.id === 'manual')
  const showPayNote = look.branding.trustBadges && !(offline && !totals.coveredByCards)
  const payNoteNames = totals.coveredByCards ? [] : processorNames(totals.offered)
  // The minimum-order line sits right above the Place order button it keeps off (#96).
  const shortfallNote = shortfall ? (
    <p
      role="status"
      className="rounded-ck border border-ck-line bg-ck-bg px-4 py-3 text-[0.875rem] text-ck-ink"
    >
      {shortfall}
    </p>
  ) : null
  const previous = sections[sections.indexOf(step) - 1]
  const signingIn = ck.customer === null && (!ck.guest || ck.accountRequired)
  const phoneCode = ck.signIn.methods.some((m) => m !== 'email')
  const emailCode = ck.signIn.methods.includes('email')
  const signInBody =
    phoneCode && emailCode
      ? content.stepIntro.signIn.both
      : phoneCode
        ? content.stepIntro.signIn.phone
        : content.stepIntro.signIn.email
  const next = nextSection(step, sections)
  const shippingValue = shippingRow(digitalOnly, shipping, rate, ck.totals.payment)
  const shippingLine = rate
    ? `${rate.name || content.delivery.standard} · ${rate.pricePaise === 0 ? content.shippingFree : formatPaise(rate.pricePaise)}`
    : shippingValue?.kind === 'pending'
      ? null
      : content.shippingFree
  const pay = (
    <CheckoutPayButton
      form={FORM_ID}
      label={ck.payLabel}
      pending={ck.pending}
      updating={ck.updating}
      disabled={payDisabled || step !== 'payment'}
      locked={step !== 'payment' || soldOut.length > 0}
    />
  )
  const continueButton = next ? (
    <button
      type="submit"
      form={FORM_ID}
      disabled={ck.pending}
      className={`${CK_BUTTON_PRIMARY} ${step === 'contact' ? 'lg:w-auto' : ''}`}
    >
      {step === 'contact' ? content.continueLabel : content.continueTo(stepLabel(next))}
      {step === 'contact' ? null : <CheckoutIcon name="chevron" className="size-4 -rotate-90" />}
    </button>
  ) : null
  const signInLink =
    ck.customer === null && ck.guest && !ck.accountRequired ? (
      <button
        type="button"
        onClick={() => ck.handleGuest(false)}
        className={`${CK_LINK} text-[0.75rem]! text-ck-muted! hover:text-ck-ink! sm:text-[0.8125rem]!`}
      >
        {copy.signIn}
      </button>
    ) : null

  return (
    <CheckoutPageShell
      look={look}
      backHref="/cart"
      backLabel={content.backToCart}
      cartLabel={content.backToCartCount(ck.cart.itemCount)}
      cartShort={`${content.review.cart} · ${ck.cart.itemCount}`}
      policies={ck.policies ?? []}
      summary={
        <SummaryDisclosure totalLabel={ck.payNow} updating={ck.updating}>
          <CheckoutSummary
            words={ck.copy}
            cart={ck.cart}
            discount={ck.discount}
            digitalOnly={digitalOnly}
            giftCards={ck.giftCards}
            onGiftCardApply={ck.handleGiftCardApply}
            onGiftCardRemove={ck.handleGiftCardRemove}
            adjustmentPaise={totals.adjustmentPaise}
            adjustmentLabel={
              totals.adjustment?.label || content.adjustmentFallback(totals.adjustmentPaise)
            }
            shipping={shippingRow(digitalOnly, shipping, rate, ck.totals.payment)}
            totalPaise={totals.totalPaise}
            gstPaise={gstPaise}
            cardRows={totals.cardRows}
            duePaise={totals.duePaise}
            laterPaise={deposit.laterPaise}
            payNowPaise={totals.payNowPaise}
            emiMonthly={ck.emiMonthly}
            notice={
              deposit.nonRefundableDays
                ? content.depositNonRefundable(deposit.nonRefundableDays)
                : null
            }
            updating={ck.updating}
            abroad={ck.abroad}
          />
        </SummaryDisclosure>
      }
      summaryAfter={
        look.branding.trustBadges ? (
          <CheckoutTrust names={payNoteNames} policies={ck.policies ?? []} />
        ) : null
      }
      summaryEnd={
        <>
          {shortfallNote}
          {pay}
          {step !== 'payment' ? (
            <p className="text-center text-[0.8125rem] text-ck-summary-muted">
              {content.completeSteps}
            </p>
          ) : showPayNote ? (
            <CheckoutPayNote names={payNoteNames} inSummary />
          ) : null}
        </>
      }
      bottomBar={
        <>
          {shortfallNote}
          {continueButton ?? pay}
          {!continueButton && showPayNote ? <CheckoutPayNote names={payNoteNames} /> : null}
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={ck.handleSubmit}
        onFocusCapture={ck.handleStayOnStep}
        className={`flex flex-col gap-6 ${soldOut.length > 0 ? '[&>*:not([data-sold-out]):not(h1)]:hidden!' : ''}`}
      >
        <h1 className="sr-only">{content.title}</h1>
        {soldOut.length > 0 ? (
          <CheckoutSoldOut
            lines={soldOut}
            others={ck.cart.lines.length - soldOut.length}
            email={ck.form.email}
            phone={ck.form.phone}
          />
        ) : null}
        <div className="flex flex-col gap-3">
          {previous ? (
            <button
              type="button"
              onClick={() => ck.handleStep(previous)}
              className="-my-1 flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded-ck text-[0.8125rem]! font-medium text-ck-muted outline-none transition-colors duration-150 hover:text-ck-ink focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] motion-reduce:transition-none"
            >
              <CheckoutIcon name="back" className="size-4" />
              {content.backTo(stepLabel(previous))}
            </button>
          ) : null}
          <CheckoutStepper
            sections={sections}
            current={step}
            label={stepLabel}
            onPick={ck.handleStep}
          />
        </div>
        <CheckoutReview
          rows={reviewRows(sections, step, ck.form, shippingLine)}
          onChange={ck.handleStep}
        />
        {/* Express checkout is off for now. To bring it back, restore this block and the
            import, `express`, `expressLine` and `showExpress` above.
        {showExpress ? (
          <ExpressPay
            heading={express.heading}
            line={expressLine}
            pending={ck.pending}
            disabled={ck.updating || ck.unserviceable || ck.shortfall > 0}
            message={ck.expressNote}
            onPay={ck.handleExpress}
          />
        ) : null}
        */}
        <CheckoutCard
          id={sectionDomId('contact')}
          headingId={sectionHeadingId('contact')}
          title={signingIn ? content.stepIntro.signIn.title : content.stepIntro.contact.title}
          body={signingIn ? signInBody : content.stepIntro.contact.body}
          active={step === 'contact'}
          aside={signInLink}
        >
          <CheckoutContact ck={ck} />
        </CheckoutCard>
        <CheckoutCard
          id={sectionDomId('address')}
          headingId={sectionHeadingId('address')}
          title={digitalOnly ? copy.detailsLabel : content.stepIntro.address.title}
          body={digitalOnly ? undefined : content.stepIntro.address.body}
          active={step === 'address'}
        >
          <CheckoutAddressBook ck={ck} />
        </CheckoutCard>
        {digitalOnly ? null : (
          <CheckoutCard
            id={sectionDomId('shipping')}
            headingId={sectionHeadingId('shipping')}
            title={content.stepIntro.shipping.title}
            body={
              shippingPlace
                ? content.stepIntro.shipping.datesFor(shippingPlace)
                : content.stepIntro.shipping.body
            }
            active={step === 'shipping'}
          >
            <DeliveryMethod
              shipping={shipping}
              rates={ck.rates}
              selectedId={ck.deliveryApp.rateId}
              checking={ck.checking}
              unserviceable={ck.unserviceable}
              estimate={ck.deliveryText}
              onSelect={ck.handleRate}
              routeKey={ck.deliveryApp.routeKey}
              onRoute={ck.deliveryApp.setRouteKey}
              insurance={ck.deliveryApp.insurance}
              onInsurance={ck.deliveryApp.toggleInsurance}
              abroad={ck.abroad}
            />
          </CheckoutCard>
        )}
        <CheckoutCard
          id={sectionDomId('payment')}
          headingId={sectionHeadingId('payment')}
          title={content.stepIntro.payment.title}
          body={content.stepIntro.payment.body}
          active={step === 'payment'}
          aside={
            <span className="text-[0.75rem] text-ck-muted max-sm:hidden">{copy.paymentNote}</span>
          }
        >
          <CheckoutPaymentStep ck={ck} />
        </CheckoutCard>
        {/* Out of the flow while empty, still in the accessibility tree so it announces. */}
        <div aria-live="assertive" className="empty:absolute">
          {error ? (
            <p
              id="checkout-error"
              className="flex items-start gap-2.5 rounded-ck border border-ck-danger/35 bg-ck-danger-soft px-4 py-3 text-[0.875rem] leading-snug text-ck-danger transition-[opacity,translate] duration-200 ease-out starting:translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
            >
              <CheckoutIcon name="alert" className="mt-0.5! size-4 shrink-0" />
              {error}
            </p>
          ) : null}
        </div>
        {continueButton && !(step === 'contact' && signingIn) ? (
          <div className={`hidden lg:flex ${step === 'contact' ? 'justify-end' : ''}`}>
            {continueButton}
          </div>
        ) : null}
        {step === 'payment' ? <CheckoutAgreement policies={ck.policies ?? []} /> : null}
      </form>
    </CheckoutPageShell>
  )
}
