import { affiliateContent } from '@/data/affiliate'
import { bpPercent } from '@/lib/affiliate-rate'
import type { AffiliatePortal } from '@/lib/affiliates'
import { money } from '@/lib/portal-format'

type ProgramDetailsProps = {
  program: AffiliatePortal['program']
  /** Show the merchant's own terms in full below the rules. */
  withTerms?: boolean
}

const copy = affiliateContent.terms
const register = affiliateContent.register

/** The program's rules in plain words (rate, which orders count, link window, hold, minimum). */
export default function ProgramDetails({ program: p, withTerms = false }: ProgramDetailsProps) {
  // Render logic
  const rule = p.rate.rule
  const rows = [
    {
      label: copy.rate,
      value:
        rule.type === 'percent'
          ? copy.rateValue(bpPercent(rule.bp))
          : copy.flatValue(money(rule.paise)),
      note: [
        p.rate.upToBp ? register.upTo(bpPercent(p.rate.upToBp)) : null,
        p.hasOverrides ? copy.overrides : null,
      ]
        .filter(Boolean)
        .join(' '),
    },
    {
      label: copy.which,
      value: p.scope === 'lifetime' ? copy.lifetime(p.lifetimeDays) : copy.firstOrder,
      note: '',
    },
    { label: copy.window, value: copy.windowValue(p.cookieDays), note: '' },
    { label: copy.hold, value: copy.holdValue(p.holdDays), note: '' },
    ...(p.couponPercent
      ? [
          {
            label: register.coupon,
            value: register.couponValue(p.couponPercent, p.couponSelected),
            note: '',
          },
        ]
      : []),
    ...(p.minPayoutPaise > 0
      ? [{ label: copy.minimum, value: money(p.minPayoutPaise), note: copy.tds }]
      : []),
  ]
  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col divide-y rounded-lg border">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-1 p-4 sm:flex-row sm:gap-6">
            <dt className="text-sm text-muted-foreground sm:w-44 sm:shrink-0">{r.label}</dt>
            <dd className="flex flex-col gap-1 text-sm">
              <span>{r.value}</span>
              {r.note ? <span className="text-muted-foreground">{r.note}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
      {withTerms && p.terms ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{copy.full}</h3>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{p.terms}</p>
        </div>
      ) : null}
    </div>
  )
}
