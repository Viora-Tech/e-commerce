import { CheckIcon as Check } from '@commerce/ui/icons'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { affiliateContent } from '@/data/affiliate'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { bpPercent, ruleAmount } from '@/lib/affiliate-rate'
import type { AffiliatePortal } from '@/lib/affiliates'

type BenefitsCardProps = { program: AffiliatePortal['program'] }

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
 * The signup page's Benefits, as on UpPromote's register page: cookie days, commission type and
 * amount, the customer discount, and the first line of the program's terms; the pitch above.
 */
export default function BenefitsCard({ program: p }: BenefitsCardProps) {
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
    <Card>
      <CardHeader>
        <CardTitle>{affiliatePortalContent.signup.benefits}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {p.pitch ? (
          <p className="whitespace-pre-line text-sm text-muted-foreground">{p.pitch}</p>
        ) : null}
        <dl className="flex flex-col gap-3">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
              <dt className="text-sm text-muted-foreground">{r.label}</dt>
              <dd className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                <span className="line-clamp-3 min-w-0">{r.value}</span>
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
