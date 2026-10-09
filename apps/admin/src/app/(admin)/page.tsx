import { redirect } from 'next/navigation'
import DashboardPage from '@/components/home/dashboard-page'
import { homeSignals } from '@/components/home/home-signals'
import { homeContent } from '@/data/home'
import { appRouter, call, serverContext } from '@/lib/api'
import { getSession } from '@/lib/auth'
import { getCopy } from '@/lib/copy-server'
import { orNoStore } from '@/lib/store-guard'

export default async function Home() {
  const context = await serverContext()
  // The guard every member passes, whatever their role (store.current needs settings.read,
  // which Staff does not have). Only "no store to work in" goes to the picker; any other
  // error reaches the error page rather than looping back to the picker.
  const member = await call(appRouter.staff.me, {}, { context }).catch(orNoStore(null))
  if (!member) redirect('/select-store')
  const [summary, charts, session, ai, apps, abandoned] = await Promise.all([
    call(appRouter.dashboard.summary, undefined, { context }),
    call(appRouter.dashboard.charts, { range: 30 }, { context }),
    getSession(),
    // AI is optional: any failure just hides "Ask AI".
    call(appRouter.ai.status, undefined, { context }).catch(() => null),
    // Apps and abandoned carts need their own permissions: without them the set-up cards and
    // those suggestions just hide.
    call(appRouter.apps.list, undefined, { context }).catch(() => null),
    call(appRouter.orders.abandonedStats, undefined, { context }).catch(() => null),
  ])
  const { fallbackName } = (await getCopy(homeContent)).briefing
  const firstName = (session?.user.name ?? fallbackName).trim().split(/\s+/)[0] ?? fallbackName
  return (
    <DashboardPage
      summary={summary}
      charts={charts}
      firstName={firstName}
      assistant={ai?.assistant ?? false}
      signals={apps ? homeSignals(apps) : null}
      abandoned={abandoned}
    />
  )
}
