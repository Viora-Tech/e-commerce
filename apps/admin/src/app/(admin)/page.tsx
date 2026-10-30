import { redirect } from 'next/navigation'
import DashboardPage from '@/components/home/dashboard-page'
import { homeSignals } from '@/components/home/home-signals'
import { homeContent } from '@/data/home'
import { appRouter, call, serverContext } from '@/lib/api'
import { getSession } from '@/lib/auth'
import { getCopy } from '@/lib/copy-server'
import { rangeFor } from '@/lib/home-range'
import { listApps, paymentsTestMode } from '@/lib/shell-data'
import { orNoStore } from '@/lib/store-guard'

export default async function Home() {
  const context = await serverContext()
  // The guard every member passes, whatever their role (store.current needs settings.read,
  // which Staff does not have). Only "no store to work in" goes to the picker; any other
  // error reaches the error page rather than looping back to the picker.
  // The page's reads start alongside the guard rather than after it; without a store they all
  // fail the same way, so that outcome is dropped and the guard sends the member to the picker.
  const memberP = call(appRouter.staff.me, {}, { context }).catch(orNoStore(null))
  const opening = rangeFor('today')
  const readsP = Promise.all([
    call(appRouter.dashboard.summary, undefined, { context }),
    call(appRouter.dashboard.charts, { range: 30 }, { context }),
    getSession(),
    // AI is optional: any failure just hides "Ask AI".
    call(appRouter.ai.status, undefined, { context }).catch(() => null),
    // Apps need their own permission: without it the set-up cards just hide. The apps list is
    // the one the layout already read.
    listApps().catch(() => null),
    call(
      appRouter.dashboard.analytics,
      { from: opening.from, to: opening.to, compare: 'previous' },
      { context },
    ),
    call(appRouter.dashboard.tiles, undefined, { context }),
    // Needs settings.read: without it the Store health card just hides.
    call(appRouter.store.health, undefined, { context }).catch(() => null),
    // Smart cards (#101) are a nice-to-have: any failure just leaves the set-up ideas.
    call(appRouter.dashboard.cards, undefined, { context }).catch(() => null),
  ])
  if (!(await memberP)) {
    readsP.catch(() => {})
    redirect('/select-store')
  }
  const [summary, charts, session, ai, apps, analytics, tiles, health, cards] = await readsP
  const { fallbackName } = (await getCopy(homeContent)).briefing
  const firstName = (session?.user.name ?? fallbackName).trim().split(/\s+/)[0] ?? fallbackName
  return (
    <DashboardPage
      summary={summary}
      charts={charts}
      analytics={{ range: opening, analytics, tiles }}
      firstName={firstName}
      assistant={ai?.assistant ?? false}
      signals={apps ? homeSignals(apps, await paymentsTestMode()) : null}
      health={health}
      cards={cards}
    />
  )
}
