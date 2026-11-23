import type { LoyaltySettings } from '@commerce/core/loyalty'
import { loyaltyAccountContent } from '@/data/loyalty'
import { ACCOUNT_CARD, ACCOUNT_CARD_TITLE, ACCOUNT_INTRO } from '@/lib/account-classes'

type PointsEarnWaysProps = { settings: LoyaltySettings }

const copy = loyaltyAccountContent.earn
const points = loyaltyAccountContent.points

/**
 * The Points page's "How you earn points": the store's own numbers (per ₹100 spent, a review,
 * the birthday) and how long points last. A way the store turned off (0) is left out.
 */
export default function PointsEarnWays({ settings }: PointsEarnWaysProps) {
  // Render logic
  const ways = [
    settings.pointsPer100 > 0 ? copy.orders(points(settings.pointsPer100)) : null,
    settings.reviewPoints > 0 ? copy.review(points(settings.reviewPoints)) : null,
    settings.birthdayPoints > 0 ? copy.birthday(points(settings.birthdayPoints)) : null,
  ].filter((w): w is string => w !== null)
  if (ways.length === 0) return null

  return (
    <section className={`${ACCOUNT_CARD} max-w-[40rem] gap-2!`} aria-labelledby="points-earn">
      <h2 id="points-earn" className={ACCOUNT_CARD_TITLE}>
        {copy.title}
      </h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-[0.9375rem] text-ck-ink">
        {ways.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      {settings.expiryMonths > 0 ? (
        <p className={ACCOUNT_INTRO}>{copy.expiry(settings.expiryMonths)}</p>
      ) : null}
    </section>
  )
}
