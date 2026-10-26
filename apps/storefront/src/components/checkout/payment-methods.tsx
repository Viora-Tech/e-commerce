'use client'

import { formatPaymentAdjustment } from '@commerce/core/adjustment-math'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content } from '@/data/checkout'
import { methodView, takesUpi } from '@/lib/checkout-preview'
import type { CheckoutMethod } from '@/lib/payments'

type PaymentMethodsProps = {
  /** Already in checkout order: UPI first, cash on delivery last. */
  methods: CheckoutMethod[]
  selected: string
  codBlocked: boolean
  /** Why cash on delivery is off for this order, when it is. */
  codNote: string | null
  onSelect: (id: string) => void
}

type MethodPanelProps = { method: CheckoutMethod }

const panel = content.methodPanel

/** Each gateway's own colour for its name chip; anything else wears the checkout's ink. */
const BRAND_COLOURS: Record<string, string> = {
  Razorpay: '#072654',
  Cashfree: '#5B3DF5',
  Decentro: '#0B0B12',
  PhonePe: '#5F259F',
  PayU: '#3A8D2F',
  Paytm: '#002E6E',
}

/**
 * Figma Checkout / Payment (490:12040): the ways to pay as one joined list of radio rows, the
 * picked row opening onto what happens next. A gateway shows its brand with what it takes;
 * UPI says how it works on this device (a QR to scan on a computer, the UPI app on a phone)
 * once Pay is tapped, since the QR and the app links only exist once the order is placed.
 * A fee or discount for a method sits on its right. Native radios, so arrow keys move the pick.
 */
export default function PaymentMethods({
  methods,
  selected,
  codBlocked,
  codNote,
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
          return (
            <div
              key={m.id}
              data-method={m.id}
              className={`rounded-ck border transition-[border-color,box-shadow,background-color] duration-150 motion-reduce:transition-none ${checked ? 'border-ck-accent bg-ck-soft/60 [box-shadow:0_0_0_1px_var(--ck-accent)]' : 'border-ck-line bg-ck-field'}`}
            >
              <label
                className={`flex min-h-16 items-center gap-3.5 px-4 py-3.5 has-[:focus-visible]:[box-shadow:inset_0_0_0_2px_var(--ck-accent)] sm:px-5 ${blocked ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`}
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
                <span
                  aria-hidden="true"
                  className={`flex size-[1.125rem] shrink-0 items-center justify-center rounded-full border transition-colors duration-150 motion-reduce:transition-none ${
                    checked ? 'border-ck-accent bg-ck-accent' : 'border-ck-muted/60 bg-ck-field'
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full bg-ck-accent-ink ${checked ? 'opacity-100' : 'opacity-0'}`}
                  />
                </span>
                {view.brand ? (
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: BRAND_COLOURS[view.brand] ?? 'var(--ck-ink)' }}
                    className="inline-flex h-6 shrink-0 items-center rounded-[0.3125rem] px-2 text-[0.6875rem] font-extrabold tracking-[0.02em] text-white"
                  >
                    {view.brand}
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className={`flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] border border-ck-line bg-ck-bg ${checked ? 'text-ck-ink' : 'text-ck-muted'}`}
                  >
                    <CheckoutIcon name={view.icon} className="size-[1.125rem]" />
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 text-[0.9375rem] leading-snug font-medium text-ck-ink">
                    <span className={view.brand ? 'sr-only' : undefined}>{view.title}</span>
                    {m.test ? (
                      <span
                        title={content.testModeHint}
                        className="rounded-full border border-ck-line bg-ck-bg px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-ck-muted uppercase"
                      >
                        {content.testMode}
                      </span>
                    ) : null}
                  </span>
                  {view.hint ? (
                    <span className="text-[0.8125rem] leading-snug text-ck-muted">{view.hint}</span>
                  ) : null}
                  {blocked && codNote ? (
                    <span className="text-[0.8125rem] leading-snug text-ck-danger">{codNote}</span>
                  ) : null}
                </span>
                {adjustment ? (
                  <span className="shrink-0 text-right text-[0.875rem] font-medium tabular-nums text-ck-ink">
                    {adjustment}
                  </span>
                ) : null}
              </label>
              {checked ? <MethodPanel method={m} /> : null}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

/** What the picked way to pay does once Pay is tapped; nothing for cash or a transfer. */
function MethodPanel({ method }: MethodPanelProps) {
  // Render logic
  const { brand } = methodView(method)
  const upi = takesUpi(method)

  // Early returns
  if (!upi && !brand) return null

  return (
    <div className="flex flex-col gap-3 px-4 pt-0.5 pb-4 motion-safe:animate-[ck-reveal_200ms_ease-out_both] sm:ps-[6.375rem] sm:pe-5">
      {upi ? (
        <>
          <p className="text-[0.875rem] font-medium text-ck-ink">{panel.upiHeading}</p>
          <p className="text-[0.8125rem] leading-relaxed text-ck-muted">
            <span className="lg:hidden">{panel.upiPhone}</span>
            <span className="hidden lg:inline">{panel.upiDesktop}</span>
          </p>
          <ul aria-label={panel.appsLabel} className="flex flex-wrap items-center gap-2">
            {panel.upiApps.map((app) => (
              <li
                key={app}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ck-line bg-ck-field ps-1 pe-3 text-[0.8125rem] font-medium text-ck-ink"
              >
                <span
                  aria-hidden="true"
                  className="flex size-6 items-center justify-center rounded-full bg-ck-soft text-[0.6875rem] font-semibold text-ck-muted"
                >
                  {app.charAt(0)}
                </span>
                {app}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {brand ? (
        <p className="flex items-center gap-1.5 text-[0.75rem] text-ck-muted">
          <CheckoutIcon name="lock" className="size-3" />
          {upi ? panel.processedBy(brand) : `${panel.gateway(brand)} ${panel.processedBy(brand)}.`}
        </p>
      ) : null}
    </div>
  )
}
