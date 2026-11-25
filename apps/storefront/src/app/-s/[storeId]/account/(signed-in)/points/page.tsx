import { loyaltyState, shopperPoints } from '@commerce/core'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AccountPageHead from '@/components/account/account-page-head'
import BirthdayForm from '@/components/account/birthday-form'
import PointsEarnWays from '@/components/account/points-earn-ways'
import PointsHistory from '@/components/account/points-history'
import { loyaltyAccountContent } from '@/data/loyalty'
import { storeTimeZone } from '@/lib/account'
import { accountHistory, historyLimit, shownFrom } from '@/lib/account-history'
import { requireCustomer } from '@/lib/customer-session'
import { inStore } from '@/lib/store-context'

type PointsPageProps = {
  params: Promise<{ storeId: string }>
  searchParams: Promise<{ show?: string | string[] }>
}

export const metadata: Metadata = { title: loyaltyAccountContent.title }

/**
 * The shopper's loyalty points (Loyalty points app): what they hold, what runs out soon, what is
 * on the way and every change. Points are store credit, spent at checkout. Missing while the
 * store does not have the app.
 */
export default async function PointsPage({ params, searchParams }: PointsPageProps) {
  const { storeId } = await params
  const shown = shownFrom((await searchParams).show)
  const me = await requireCustomer(storeId, '/account/points')
  const data = await inStore(storeId, async (tx) => {
    const state = await loyaltyState(tx, storeId)
    if (!state.installed) return null
    return {
      settings: state.settings,
      points: await shopperPoints({ storeId, tx }, me.id, historyLimit(shown)),
      timeZone: await storeTimeZone(tx, storeId),
    }
  })
  if (!data) notFound()
  const { settings, points, timeZone } = data
  const history = accountHistory(points.entries, shown)
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
        <PointsEarnWays settings={settings} />
        {!points.birthday && settings.birthdayPoints > 0 ? (
          <div className="max-w-[40rem]">
            <BirthdayForm birthdayPoints={settings.birthdayPoints} />
          </div>
        ) : null}
      </div>
    </>
  )
}
