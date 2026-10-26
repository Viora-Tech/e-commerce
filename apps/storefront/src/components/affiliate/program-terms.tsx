import { formatPaise } from '@commerce/blocks'
import { affiliateContent } from '@/data/affiliate'
import { bpPercent } from '@/lib/affiliate-rate'
import type { AffiliatePortal } from '@/lib/affiliates'

type ProgramTermsProps = { program: AffiliatePortal['program'] }

const copy = affiliateContent.terms

/** The program's rules in plain words, from its settings, with the merchant's own terms below. */
export default function ProgramTerms({ program: p }: ProgramTermsProps) {
  // Render logic
  const rule = p.rate.rule
  const rows = [
    {
      label: copy.rate,
      value:
        rule.type === 'percent'
          ? copy.rateValue(bpPercent(rule.bp))
          : copy.flatValue(formatPaise(rule.paise)),
      note: p.hasOverrides ? copy.overrides : null,
    },
    {
      label: copy.which,
      value: p.scope === 'lifetime' ? copy.lifetime(p.lifetimeDays) : copy.firstOrder,
      note: null,
    },
    { label: copy.window, value: copy.windowValue(p.cookieDays), note: null },
    { label: copy.hold, value: copy.holdValue(p.holdDays), note: null },
    ...(p.minPayoutPaise > 0
      ? [{ label: copy.minimum, value: formatPaise(p.minPayoutPaise), note: copy.tds }]
      : []),
  ]

  return (
    <section className="flex flex-col gap-3">
      <h2 className="h4">{copy.title}</h2>
      <dl className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-1 p-4 sm:flex-row sm:gap-6">
            <dt className="text-small text-muted sm:w-40 sm:shrink-0">{r.label}</dt>
            <dd className="flex flex-col gap-1 text-body">
              <span>{r.value}</span>
              {r.note ? <span className="text-small text-muted">{r.note}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
      {p.terms ? (
        <details className="text-small">
          <summary className="cursor-pointer font-medium">{copy.full}</summary>
          <p className="mt-2 whitespace-pre-wrap text-muted">{p.terms}</p>
        </details>
      ) : null}
    </section>
  )
}
