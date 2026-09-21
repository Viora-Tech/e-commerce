import { redirect } from 'next/navigation'
import DashboardPage from '@/components/home/dashboard-page'
import { appRouter, call, serverContext } from '@/lib/api'

export default async function Home() {
  const context = await serverContext()
  const current = await call(appRouter.store.current, undefined, { context }).catch(() => null)
  if (!current) redirect('/select-store')
  const summary = await call(appRouter.dashboard.summary, undefined, { context })
  return <DashboardPage summary={summary} />
}
