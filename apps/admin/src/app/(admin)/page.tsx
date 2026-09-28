import { redirect } from 'next/navigation'
import DashboardPage from '@/components/home/dashboard-page'
import { homeContent } from '@/data/home'
import { appRouter, call, serverContext } from '@/lib/api'
import { getSession } from '@/lib/auth'
import { getCopy } from '@/lib/copy-server'

export default async function Home() {
  const context = await serverContext()
  const current = await call(appRouter.store.current, undefined, { context }).catch(() => null)
  if (!current) redirect('/select-store')
  const [summary, charts, session] = await Promise.all([
    call(appRouter.dashboard.summary, undefined, { context }),
    call(appRouter.dashboard.charts, { range: 30 }, { context }),
    getSession(),
  ])
  const { fallbackName } = (await getCopy(homeContent)).briefing
  const firstName = (session?.user.name ?? fallbackName).trim().split(/\s+/)[0] ?? fallbackName
  return <DashboardPage summary={summary} charts={charts} firstName={firstName} />
}
