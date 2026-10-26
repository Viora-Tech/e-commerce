import { affiliateContent } from '@/data/affiliate'
import { bpPercent, ruleAmount } from '@/lib/affiliate-rate'
import type { AffiliatePortal } from '@/lib/affiliates'

type AffiliateLandingProps = { program: AffiliatePortal['program'] }

const copy = affiliateContent.landing

/** The signup page's pitch: what the program pays, its perks, and the three steps. */
export default function AffiliateLanding({ program: p }: AffiliateLandingProps) {
  // Render logic
  const percent = p.rate.rule.type === 'percent'
  const perks = [
    ...(p.couponPercent ? [copy.perks.coupon(p.couponPercent)] : []),
    copy.perks.window(p.cookieDays),
    copy.perks.payout,
    copy.perks.free,
  ]

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <p className="text-small font-semibold tracking-wide text-muted uppercase">
          {copy.eyebrow}
        </p>
        <h1 className="h1 text-balance">{copy.headline(ruleAmount(p.rate.rule), percent)}</h1>
        {p.rate.upToBp ? (
          <p className="text-body font-medium">{copy.upTo(bpPercent(p.rate.upToBp))}</p>
        ) : null}
        <p className="max-w-[40rem] text-body text-muted whitespace-pre-line">
          {p.pitch || affiliateContent.intro}
        </p>
        <ul className="flex flex-wrap gap-2">
          {perks.map((perk) => (
            <li key={perk} className="rounded-full border border-line px-3 py-1 text-small">
              {perk}
            </li>
          ))}
        </ul>
      </header>
      <section className="flex flex-col gap-4">
        <h2 className="h4">{copy.stepsTitle}</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {copy.steps.map((s, i) => (
            <li
              key={s.title}
              className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-5"
            >
              <span
                aria-hidden
                className="flex! size-8 items-center justify-center rounded-full bg-ink! text-small font-semibold text-bg!"
              >
                {i + 1}
              </span>
              <h3 className="text-body font-semibold">{s.title}</h3>
              <p className="text-small text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
