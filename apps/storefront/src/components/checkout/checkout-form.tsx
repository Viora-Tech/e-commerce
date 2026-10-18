'use client'

import { formatPaise } from '@commerce/blocks'
import CheckoutAddressStep from '@/components/checkout/checkout-address-step'
import CheckoutContactStep from '@/components/checkout/checkout-contact-step'
import CheckoutPayFooter from '@/components/checkout/checkout-pay-footer'
import CheckoutPaymentStep from '@/components/checkout/checkout-payment-step'
import CheckoutProgress from '@/components/checkout/checkout-progress'
import CheckoutRecap from '@/components/checkout/checkout-recap'
import CheckoutStepNav from '@/components/checkout/checkout-step-nav'
import CheckoutStepPanel from '@/components/checkout/checkout-step-panel'
import CheckoutStepsShell from '@/components/checkout/checkout-steps-shell'
import CheckoutSummary from '@/components/checkout/checkout-summary'
import DeliveryMethod from '@/components/checkout/delivery-method'
import SummaryDisclosure from '@/components/checkout/summary-disclosure'
import { checkoutContent as content } from '@/data/checkout'
import { shippingRow, trustMethodNames } from '@/lib/checkout-preview'
import { recapRows } from '@/lib/checkout-recap'
import type { CheckoutStep } from '@/lib/checkout-steps'
import { type CheckoutFormInput, useCheckoutForm } from '@/lib/use-checkout-form'
import { useCheckoutGst } from '@/lib/use-checkout-gst'
import { stepHeadingId } from '@/lib/use-checkout-step'

type CheckoutFormProps = CheckoutFormInput

const copy = content.steps

/** The intro under a step's heading; Contact's sign-in block says it in its own words. */
function stepIntro(step: CheckoutStep, digitalOnly: boolean, place: string | null): string | null {
  if (step === 'contact') return null
  if (step === 'payment') return copy.intro.payment
  if (step === 'shipping') return place ? copy.intro.shipping(place) : copy.intro.shippingNoPlace
  return digitalOnly ? copy.intro.details : copy.intro.address
}

/**
 * The locked checkout in four steps (Figma Checkout): Contact → Address → Delivery → Payment, with
 * the order summary beside every step (a fold-out bar on a phone). The step lives in the
 * URL, so back, forward and reload behave; each step's gate decides how far the shopper may
 * go. One form for the whole checkout (#224); the logic is `useCheckoutForm`, and the
 * server re-checks and re-prices everything on Pay.
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
  const { totals, deposit, look, step, shipping, rate } = ck
  const { digitalOnly } = totals
  const labels: Record<CheckoutStep, string> = {
    ...copy.label,
    address: digitalOnly ? copy.detailsLabel : copy.label.address,
  }
  const at = ck.steps.indexOf(step)
  const next = ck.steps[at + 1]
  const paying = next === undefined
  const place = ck.form.pincode ? [ck.form.pincode, ck.form.city].filter(Boolean).join(', ') : null
  const title = step === 'address' && digitalOnly ? copy.detailsHeading : copy.heading[step]
  const primaryLabel =
    next === 'address' || next === 'shipping' || next === 'payment'
      ? copy.continueTo[next]
      : ck.payLabel
  // Pay and Continue on Shipping wait for the courier's quote (the price is part of the total).
  const quoting = (paying || step === 'shipping') && ck.gates.shipping === 'pending'
  const shortfall =
    ck.shortfall > 0
      ? content.minimumOrder(formatPaise(ck.settings.minimumOrderPaise), formatPaise(ck.shortfall))
      : null

  return (
    <CheckoutStepsShell
      look={look}
      backHref="/cart"
      backLabel={content.backToCart}
      summary={
        <SummaryDisclosure totalLabel={ck.payNow} updating={ck.updating}>
          <CheckoutSummary
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
            shipping={shippingRow(digitalOnly, shipping, rate)}
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
    >
      <form noValidate onSubmit={ck.handleSubmit} className="flex flex-col gap-8">
        <h1 className="sr-only">{content.title}</h1>
        <CheckoutProgress steps={ck.steps} current={step} labels={labels} onGo={ck.handleGoto} />
        <CheckoutRecap
          rows={recapRows({
            step,
            steps: ck.steps,
            form: ck.form,
            digitalOnly,
            rate: rate ?? null,
            arrives: shipping?.arrives ?? null,
          })}
          onChange={ck.handleGoto}
        />
        <CheckoutStepPanel
          headingId={stepHeadingId(step)}
          title={title}
          intro={stepIntro(step, digitalOnly, place)}
        >
          {step === 'contact' ? (
            <CheckoutContactStep ck={ck} />
          ) : step === 'address' ? (
            <CheckoutAddressStep ck={ck} />
          ) : step === 'shipping' ? (
            <DeliveryMethod
              shipping={shipping}
              rates={ck.rates}
              selectedId={ck.rateId}
              checking={ck.checking}
              unserviceable={ck.unserviceable}
              estimate={ck.deliveryText}
              onSelect={ck.handleRate}
            />
          ) : (
            <CheckoutPaymentStep ck={ck} />
          )}
        </CheckoutStepPanel>
        <CheckoutPayFooter
          error={
            ck.error ??
            (ck.needsContact
              ? ck.accountRequired
                ? content.otp.needSignInRequired
                : content.otp.needSignIn
              : ck.toFix > 0
                ? content.validation.fixFields(ck.toFix)
                : null)
          }
          shortfall={shortfall}
          policies={paying ? (ck.policies ?? []) : []}
          trust={paying && look.branding.trustBadges ? trustMethodNames(totals.offered) : null}
          nav={
            <CheckoutStepNav
              label={primaryLabel}
              pays={paying}
              pending={ck.pending}
              updating={quoting}
              disabled={
                paying
                  ? ck.unserviceable || ck.shortfall > 0 || ck.gates.shipping === 'blocked'
                  : step === 'shipping' && ck.gates.shipping !== 'ok'
              }
              onBack={at > 0 ? ck.handleBack : null}
              backLabel={at > 0 ? copy.goTo(labels[ck.steps[at - 1] as CheckoutStep]) : ''}
            />
          }
        />
      </form>
    </CheckoutStepsShell>
  )
}
