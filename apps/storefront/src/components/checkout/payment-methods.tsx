'use client'

import { formatPaymentAdjustment } from '@commerce/core/adjustment-math'
import PaymentMark, { type PaymentMarkName } from '@/components/checkout/payment-mark'
import RadioDot from '@/components/checkout/radio-dot'
import { checkoutContent as content } from '@/data/checkout'
import { CK_PICKED, CK_UNPICKED } from '@/lib/checkout-classes'
import { methodView, takesUpi } from '@/lib/checkout-preview'
import type { CheckoutMethod } from '@/lib/payments'

type PaymentMethodsProps = {
  /** Already in checkout order: UPI first, cash on delivery last. */
  methods: CheckoutMethod[]
  selected: string
  codBlocked: boolean
  /** Why cash on delivery is off for this order, when it is. */
  codNote: string | null
  /** What Pay charges now ("₹648"), for the UPI detail. */
  amountLabel: string
  onSelect: (id: string) => void
}

const panel = content.methodPanel

/** The small marks under a way to pay: the UPI apps, or what a gateway takes. */
function marksFor(m: CheckoutMethod): readonly PaymentMarkName[] {
  if (m.id === 'decentro') return panel.upiApps
  if (m.id !== 'razorpay' && m.id !== 'cashfree') return []
  const cards = !m.methods || m.methods.includes('card')
  return [...(takesUpi(m) ? [panel.upiMark] : []), ...(cards ? panel.cardMarks : [])]
}

/** What opens under the picked way to pay: how it goes once Pay is tapped. */
function detailFor(m: CheckoutMethod, amountLabel: string): string | null {
  const view = methodView(m)
  if (m.id === 'decentro') return panel.upi(amountLabel)
  if (m.id === 'cod' || m.id === 'manual') return view.hint
  if (view.brand && view.hint) return panel.gateway(view.hint, view.brand)
  return view.hint
}

/**
 * The Payment card (design: checkout-design Main/Mobile): one radio card per way to pay, UPI
 * first. A gateway shows its name chip in its own colour and the marks of what it takes; a
 * discount for a method (UPI −2%) is a green chip on the right. The picked card opens onto
 * what happens next: its detail grows open (grid rows and opacity, 200ms ease-out) and the
 * last one folds away, so switching reads as one movement. Native radios, so arrow keys
 * move the pick. The QR and the app links only exist once the order is placed.
 */
export default function PaymentMethods({
  methods,
  selected,
  codBlocked,
  codNote,
  amountLabel,
  onSelect,
}: PaymentMethodsProps) {
  return (
    <fieldset className="border-0! p-0!">
      <legend className="sr-only">{content.payment}</legend>
      <div className="flex flex-col gap-2">
        {methods.map((m) => {
          const view = methodView(m)
          const checked = selected === m.id
          const blocked = m.id === 'cod' && codBlocked
          const adjustment =
            m.adjustment && m.adjustment.value !== 0 ? formatPaymentAdjustment(m.adjustment) : null
          const saving = (m.adjustment?.value ?? 0) < 0
          const marks = marksFor(m)
          const detail = detailFor(m, amountLabel)
          return (
            <div
              key={m.id}
              data-method={m.id}
              className={`rounded-ck border transition-[border-color,box-shadow,background-color] duration-150 ease-out motion-reduce:transition-none ${checked ? CK_PICKED : CK_UNPICKED}`}
            >
              <label
                className={`flex items-center gap-2.5 rounded-ck px-3.5 py-3 has-[:focus-visible]:[box-shadow:inset_0_0_0_2px_var(--ck-accent)] sm:gap-3 sm:px-4 sm:py-3.5 ${blocked ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  name="payment"
                  value={m.id}
                  checked={checked}
                  disabled={blocked}
                  onChange={() => onSelect(m.id)}
                  className="peer sr-only"
                />
                <RadioDot checked={checked} />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex flex-wrap items-center gap-1.5 text-[0.8125rem] leading-snug font-semibold text-ck-ink sm:gap-2 sm:text-[0.875rem]">
                    <span>{view.brand ? panel.secure(view.brand) : view.title}</span>
                    {m.test ? (
                      <span
                        title={content.testModeHint}
                        className="rounded-full border border-ck-line bg-ck-bg px-2 py-0.5 text-[0.75rem] font-medium text-ck-muted"
                      >
                        {content.testMode}
                      </span>
                    ) : null}
                  </span>
                  {m.id === 'cod' && codNote ? (
                    <span
                      className={`text-[0.75rem] leading-snug ${blocked ? 'text-ck-danger' : 'text-ck-muted'}`}
                    >
                      {codNote}
                    </span>
                  ) : null}
                </span>
                {marks.length > 0 ? (
                  <span aria-hidden="true" className="flex shrink-0 items-center gap-1">
                    {marks.map((mark) => (
                      <PaymentMark key={mark} mark={mark} />
                    ))}
                  </span>
                ) : null}
                {adjustment ? (
                  <span
                    className={`flex h-[1.375rem] shrink-0 items-center rounded-[0.375rem] px-[0.4375rem] text-[0.6875rem] font-semibold tabular-nums sm:h-6 sm:px-2 sm:text-[0.75rem] ${saving ? 'bg-ck-success/12 text-ck-success' : 'bg-ck-soft text-ck-muted'}`}
                  >
                    {adjustment}
                  </span>
                ) : null}
              </label>
              {detail ? (
                <div
                  inert={!checked}
                  className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-[opacity] ${checked ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <p className="ps-[2.625rem] pe-3.5 pb-3.5 text-[0.75rem] leading-[1.55] text-ck-muted sm:ps-[2.75rem] sm:pe-4 sm:pb-4 sm:text-[0.8125rem]">
                      {detail}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
