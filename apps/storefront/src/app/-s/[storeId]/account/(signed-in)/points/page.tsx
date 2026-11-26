import { loyaltyState, shopperPoints } from '@commerce/core'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AccountPageHead from '@/components/account/account-page-head'
import BirthdayForm from '@/components/account/birthday-form'
import PointsEarnWays from '@/components/account/points-earn-ways'
import PointsHistory from '@/components/account/points-history'
import PointsLoyalty from '@/components/account/points-loyalty'
import { loyaltyAccountContent } from '@/data/loyalty'
import { storeTimeZone } from '@/lib/account'
import { accountHistory, historyLimit, shownFrom } from '@/lib/account-history'
import { requireCustomer } from '@/lib/customer-session'
import { loyaltyViewFor, storeBrandFor } from '@/lib/loyalty-view'
import { requestOrigin } from '@/lib/seo'
import { inStore } from '@/lib/store-context'

type PointsPageProps = {
  params: Promise<{ storeId: string }>
  searchParams: Promise<{ show?: string | string[] }>
}

export const metadata: Metadata = { title: loyaltyAccountContent.title }

/**
 * The shopper's loyalty points (Loyalty points app): what they hold, what runs out soon, what is
 * on the way and every change, then the v2 cards (tier, rewards to claim, their codes, ways to
 * earn with click-through, the referral link). Missing while the store does not have the app.
 */
export default async function PointsPage({ params, searchParams }: PointsPageProps) {
  const { storeId } = await params
  const shown = shownFrom((await searchParams).show)
  const me = await requireCustomer(storeId, '/account/points')
  const data = await inStore(storeId, async (tx) => {
    const state = await loyaltyState(tx, storeId)
    if (!state.installed || !state.settings.pages.account) return null
    return {
      settings: state.settings,
      points: await shopperPoints({ storeId, tx }, me.id, historyLimit(shown)),
      timeZone: await storeTimeZone(tx, storeId),
    }
  })
  if (!data) notFound()
  const { settings, points, timeZone } = data
  const history = accountHistory(points.entries, shown)
  // Loyalty v2: tier, rewards, codes, ways to earn and the referral link (the widget's cards).
  const [view, brand] = await Promise.all([
    loyaltyViewFor(storeId, await requestOrigin()),
    storeBrandFor(storeId).catch(() => null),
  ])
  const member = view?.member ?? null
  return (
    <>
      <AccountPageHead title={loyaltyAccountContent.title} />
      <div className="flex flex-col gap-4">
        <PointsHistory
          points={points.points}
          expiringSoon={points.expiringSoon}
          pendingPoints={points.pendingPoints}
          birthday={points.birthday}
          entries={history.visible}
          moreHref={history.moreHref}
          timeZone={timeZone}
        />
        {view && member ? <PointsLoyalty view={view} member={member} brand={brand} /> : null}
        {view && member && view.waysToEarn.length > 0 ? null : (
          <PointsEarnWays settings={settings} />
        )}
        {!points.birthday && settings.birthdayPoints > 0 ? (
          <div className="max-w-[40rem]">
            <BirthdayForm birthdayPoints={settings.birthdayPoints} />
          </div>
        ) : null}
      </div>
    </>
  )
}
