'use client'

import { formatPaymentAdjustment } from '@commerce/core/adjustment-math'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import PaymentMark, { type PaymentMarkName } from '@/components/checkout/payment-mark'
import RadioDot from '@/components/checkout/radio-dot'
import { checkoutContent as content } from '@/data/checkout'
import { methodView, takesUpi } from '@/lib/checkout-preview'
import { PAYMENT_LOGOS, type PaymentLogoName } from '@/lib/payment-logos'
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

/** The real logo on a way to pay's tile, when it has one. */
function logoFor(m: CheckoutMethod): PaymentLogoName | null {
  if (m.id === 'razorpay') return 'razorpay'
  if (m.id === 'decentro') return 'upi'
  if (m.id === 'manual' && m.manualKinds?.length === 1 && m.manualKinds[0] === 'upi') return 'upi'
  return null
}

/** What opens under the picked way to pay: how it goes once Pay is tapped. */
function detailFor(m: CheckoutMethod, amountLabel: string): string | null {
  const view = methodView(m)
  if (m.id === 'decentro') return panel.upi(amountLabel)
  return view.brand ? panel.gateway(view.brand) : null
}

/**
 * The Payment card, grouped like the admin's settings lists: one row per way to pay, UPI first,
 * each with its logo on a tile, its name and what it takes, and the real marks of what it
 * accepts. A discount for a method (UPI −2%) is a green pill on the right. The picked row wears
 * the store's accent and opens onto what happens next: its detail grows open (grid rows and opacity, 200ms ease-out) and the
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
      <div className="divide-y divide-ck-line overflow-hidden rounded-[calc(var(--ck-radius)*1.2)] border border-ck-line">
        {methods.map((m) => {
          const view = methodView(m)
          const checked = selected === m.id
          const blocked = m.id === 'cod' && codBlocked
          const adjustment =
            m.adjustment && m.adjustment.value !== 0 ? formatPaymentAdjustment(m.adjustment) : null
          const saving = (m.adjustment?.value ?? 0) < 0
          const marks = marksFor(m)
          const logo = logoFor(m)
          const detail = detailFor(m, amountLabel)
          return (
            <div
              key={m.id}
              data-method={m.id}
              className={`transition-[box-shadow,background-color] duration-150 ease-out motion-reduce:transition-none ${checked ? 'bg-ck-soft [box-shadow:inset_0.1875rem_0_0_var(--ck-accent)]' : 'hover:bg-ck-soft'}`}
            >
              <label
                className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3 has-[:focus-visible]:[box-shadow:inset_0_0_0_2px_var(--ck-accent)] sm:flex-nowrap sm:px-4 ${blocked ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`}
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
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ck-qr [box-shadow:inset_0_0_0_1px_rgb(0_0_0/0.06)]">
                  {logo ? (
                    // biome-ignore lint/performance/noImgElement: inline data URI, nothing to optimise.
                    <img
                      src={PAYMENT_LOGOS[logo]}
                      alt=""
                      className="block h-auto! max-h-6! w-auto! max-w-7.5!"
                    />
                  ) : (
                    <CheckoutIcon name={view.icon} className="size-5 text-ck-accent" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 text-[0.9375rem] leading-snug font-semibold text-ck-ink">
                    {view.title}
                    {m.test ? (
                      <span
                        title={content.testModeHint}
                        className="rounded-full border border-ck-line bg-ck-bg px-2 py-0.5 text-[0.75rem] font-medium text-ck-muted"
                      >
                        {content.testMode}
                      </span>
                    ) : null}
                  </span>
                  {view.hint ? (
                    <span className="text-[0.8125rem] leading-snug text-ck-muted">{view.hint}</span>
                  ) : null}
                  {m.id === 'cod' && codNote ? (
                    <span
                      className={`text-[0.75rem] leading-snug ${blocked ? 'text-ck-danger' : 'text-ck-muted'}`}
                    >
                      {codNote}
                    </span>
                  ) : null}
                </span>
                {marks.length > 0 ? (
                  <span
                    aria-hidden="true"
                    className="flex w-full shrink-0 flex-wrap items-center gap-1 ps-[5rem] sm:w-auto sm:ps-0"
                  >
                    {marks.map((mark) => (
                      <PaymentMark key={mark} mark={mark} />
                    ))}
                  </span>
                ) : null}
                {adjustment ? (
                  <span
                    className={`flex h-6 shrink-0 items-center rounded-full border px-2.5 text-[0.75rem] font-semibold tabular-nums ${saving ? 'border-ck-success/30 bg-ck-success/12 text-ck-success' : 'border-ck-line bg-ck-soft text-ck-muted'}`}
                  >
                    {saving ? panel.saving(adjustment) : adjustment}
                  </span>
                ) : null}
              </label>
              {detail ? (
                <div
                  inert={!checked}
                  className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-[opacity] ${checked ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <p className="ps-[5.875rem] pe-3.5 pb-3 text-[0.8125rem] leading-[1.55] text-ck-muted sm:ps-[6rem] sm:pe-4">
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
