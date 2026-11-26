import { affiliateContent } from '@/data/affiliate'
import { bpPercent, ruleAmount } from '@/lib/affiliate-rate'
import type { AffiliatePortal } from '@/lib/affiliates'

type AffiliateBenefitsProps = { program: AffiliatePortal['program'] }

const copy = affiliateContent.register

/** The merchant's terms' first line, for the short "Additional terms" row. */
function firstLine(terms: string): string {
  return (
    terms
      .split('\n')
      .map((l) => l.trim())
      .find(Boolean) ?? ''
  )
}

/**
 * The bordered "Benefits" box on the signup page: cookie days, commission type and amount,
 * the customer discount when the program gives one, and the first line of the program's terms.
 */
export default function AffiliateBenefits({ program: p }: AffiliateBenefitsProps) {
  // Render logic
  const rule = p.rate.rule
  const terms = firstLine(p.terms)
  const rows = [
    { label: copy.cookieDays, value: copy.cookieValue(p.cookieDays) },
    { label: copy.type, value: rule.type === 'percent' ? copy.percent : copy.fixed },
    {
      label: copy.amount,
      value: p.rate.upToBp
        ? `${ruleAmount(rule)}, ${copy.upTo(bpPercent(p.rate.upToBp))}`
        : ruleAmount(rule),
    },
    ...(p.couponPercent
      ? [{ label: copy.coupon, value: copy.couponValue(p.couponPercent, p.couponSelected) }]
      : []),
    ...(terms ? [{ label: copy.terms, value: terms }] : []),
  ]
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line p-4 sm:p-5">
      <h2 className="text-body font-semibold">{copy.benefits}</h2>
      <dl className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
            <dt className="text-small text-muted">{r.label}</dt>
            <dd className="flex items-start gap-2 text-small">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="mt-[0.125rem] size-[0.875rem] shrink-0 text-success"
              >
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              <span className="line-clamp-3 min-w-0">{r.value}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
