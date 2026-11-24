import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { formatPaise } from '../../money'
import { tierPercent } from './loyalty-math'
import type { LoyaltyMemberView, LoyaltyPointsName, LoyaltyTierView } from './loyalty-types'

type LoyaltyTierCardProps = {
  tiers: LoyaltyTierView[]
  tier: LoyaltyMemberView['tier']
  names: LoyaltyPointsName
}

/** "1.25" for 12500 basis points. */
const times = (bp: number) => String(Math.round(bp / 100) / 100)

/**
 * The member's VIP tier: its name in the tier's colours, its perks, and a bar to the next tier
 * ("120 points more to reach Gold", or the spend still needed). Nothing when the store has no tiers.
 */
export default function LoyaltyTierCard({ tiers, tier, names }: LoyaltyTierCardProps) {
  // Helpers
  const amount = (n: number) =>
    tier.basis === 'spend' ? copy.tier.spend(formatPaise(n)) : copy.points(n, names)

  // Early returns
  if (tiers.length === 0) return null

  // Render logic
  const current = tiers.find((t) => t.id === tier.currentId) ?? null
  const next = tiers.find((t) => t.id === tier.nextId) ?? null
  const pct = tierPercent(tier.value, next?.threshold ?? null)
  const colors = current?.colors
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-(--kl-line) p-4">
      <span className="text-[0.8125rem] font-medium text-(--kl-muted)">{copy.tier.current}</span>
      <span
        className="self-start rounded-full bg-(--kl-soft) px-3 py-1 text-[0.9375rem] font-bold text-(--kl-ink)"
        style={colors ? { background: colors.background, color: colors.text } : undefined}
      >
        {current?.name ?? copy.tier.none}
      </span>
      {current && current.multiplierBp > 10_000 ? (
        <span className="text-[0.8125rem] text-(--kl-muted)">
          {copy.tier.multiplier(times(current.multiplierBp))}
        </span>
      ) : null}
      {current && current.perks.length > 0 ? (
        <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-[0.875rem] text-(--kl-ink)">
          {current.perks.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 overflow-hidden rounded-full bg-(--kl-soft)"
      >
        <div className="h-full rounded-full bg-(--kl-head-solid)" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[0.8125rem] text-(--kl-muted)">
        {next ? copy.tier.toNext(amount(tier.toNext), next.name) : copy.tier.top}
      </span>
    </section>
  )
}
