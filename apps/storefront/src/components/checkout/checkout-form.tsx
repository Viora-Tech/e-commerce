'use client'

import { formatPaise } from '@commerce/blocks'
import CheckoutAddressBook from '@/components/checkout/checkout-address-book'
import CheckoutAgreement from '@/components/checkout/checkout-agreement'
import CheckoutCard from '@/components/checkout/checkout-card'
import CheckoutContact from '@/components/checkout/checkout-contact'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import CheckoutPageShell from '@/components/checkout/checkout-page-shell'
import CheckoutPayButton from '@/components/checkout/checkout-pay-button'
import CheckoutPaymentStep from '@/components/checkout/checkout-payment-step'
import CheckoutSummary from '@/components/checkout/checkout-summary'
import DeliveryMethod from '@/components/checkout/delivery-method'
import ExpressPay from '@/components/checkout/express-pay'
import SummaryDisclosure from '@/components/checkout/summary-disclosure'
import { checkoutContent as content } from '@/data/checkout'
import { CK_LINK } from '@/lib/checkout-classes'
import { processorNames, shippingRow } from '@/lib/checkout-preview'
import { type CheckoutSection, sectionDomId, sectionHeadingId } from '@/lib/checkout-sections'
import { cleanPincode } from '@/lib/checkout-validation'
import { type CheckoutFormInput, useCheckoutForm } from '@/lib/use-checkout-form'
import { useCheckoutGst } from '@/lib/use-checkout-gst'

type CheckoutFormProps = CheckoutFormInput

const FORM_ID = 'checkout-form'

/** A card's number on this page: 1 Contact, 2 Delivery, then Shipping when there is one. */
const numberIn = (sections: readonly CheckoutSection[], s: CheckoutSection): number =>
  sections.indexOf(s) + 1

/**
 * The checkout on one page (design: checkout-design Main.dc.html and Mobile.dc.html): Express
 * checkout at the top, then numbered cards, 1 Contact, 2 Delivery, 3 Shipping, 4 Payment, all
 * open at once, with the order summary on the right from `lg` (a fold-out card at the top on
 * a phone) and Pay in the summary card on a computer or in a bar stuck to the bottom of a
 * phone. Each card's number turns into a tick once its part is filled in. One form for the
 * whole checkout (#224); the logic is `useCheckoutForm`, and the server re-checks and
 * re-prices everything on Pay.
 */
export default function CheckoutForm(props: CheckoutFormProps) {
  // Hooks
  const ck = useCheckoutForm(props)
  const gstPaise = useCheckoutGst({
    totalPaise: ck.totals.totalPaise,
    reductionPaise: (ck.discount?.amountPaise ?? 0) + Math.max(0, -ck.totals.adjustmentPaise),
    stateCode: ck.form.stateCode || null,
  })

  // Render logic
  // The store's own wording over ours (#158).
  const copy = ck.copy.sections
  const express = ck.copy.express
  const { totals, deposit, look, shipping, rate, done, sections } = ck
  const { digitalOnly } = totals
  const pincode = cleanPincode(ck.form.pincode)
  const fullPincode = /^[1-9]\d{5}$/.test(pincode)
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
  const payDisabled = ck.unserviceable || ck.shortfall > 0
  const footnote = look.branding.trustBadges
    ? content.payFootnote(totals.coveredByCards ? [] : processorNames(totals.offered))
    : null
  const pay = (
    <CheckoutPayButton
      form={FORM_ID}
      label={ck.payLabel}
      pending={ck.pending}
      updating={ck.updating}
      disabled={payDisabled}
    />
  )
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
      secureLabel={ck.copy.secure}
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
          />
        </SummaryDisclosure>
      }
      summaryEnd={
        <>
          {!digitalOnly && fullPincode && ck.deliveryBy ? (
            <p className="flex items-center gap-2.5 rounded-ck bg-ck-summary-line p-3 text-[0.75rem] transition-[opacity,translate] duration-200 ease-out starting:translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0">
              <CheckoutIcon name="truck" className="size-[1.125rem] shrink-0" />
              <span>
                {content.deliversTo.to} <strong className="font-semibold">{pincode}</strong>{' '}
                {content.deliversTo.by} <strong className="font-semibold">{ck.deliveryBy}</strong>
              </span>
            </p>
          ) : null}
          {pay}
          {footnote ? (
            <p className="text-center text-[0.75rem] text-ck-summary-muted">{footnote}</p>
          ) : null}
        </>
      }
      bottomBar={
        <>
          {pay}
          {footnote ? (
            <p className="text-center text-[0.6875rem] text-ck-muted">{footnote}</p>
          ) : null}
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={ck.handleSubmit}
        className="flex flex-col gap-3 sm:gap-4"
      >
        <h1 className="sr-only">{content.title}</h1>
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
        <CheckoutCard
          id={sectionDomId('contact')}
          headingId={sectionHeadingId('contact')}
          number={numberIn(sections, 'contact')}
          title={copy.label.contact}
          done={done.contact}
          aside={signInLink}
        >
          <CheckoutContact ck={ck} />
        </CheckoutCard>
        <CheckoutCard
          id={sectionDomId('address')}
          headingId={sectionHeadingId('address')}
          number={numberIn(sections, 'address')}
          title={digitalOnly ? copy.detailsLabel : copy.label.address}
          done={done.address}
        >
          <CheckoutAddressBook ck={ck} />
        </CheckoutCard>
        {digitalOnly ? null : (
          <CheckoutCard
            id={sectionDomId('shipping')}
            headingId={sectionHeadingId('shipping')}
            number={numberIn(sections, 'shipping')}
            title={copy.label.shipping}
            done={done.shipping}
            aside={
              fullPincode ? (
                <span className="text-[0.75rem] text-ck-muted">{copy.shippingTo(pincode)}</span>
              ) : null
            }
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
            />
          </CheckoutCard>
        )}
        <CheckoutCard
          id={sectionDomId('payment')}
          headingId={sectionHeadingId('payment')}
          number={numberIn(sections, 'payment')}
          title={copy.label.payment}
          aside={<span className="text-[0.75rem] text-ck-muted">{copy.paymentNote}</span>}
        >
          <CheckoutPaymentStep ck={ck} />
        </CheckoutCard>
        {shortfall ? (
          <p
            role="status"
            className="rounded-ck border border-ck-line bg-ck-bg px-4 py-3 text-[0.875rem] text-ck-ink"
          >
            {shortfall}
          </p>
        ) : null}
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
        <CheckoutAgreement policies={ck.policies ?? []} />
      </form>
    </CheckoutPageShell>
  )
}
