import { redirect } from 'next/navigation'
import DashboardPage from '@/components/home/dashboard-page'
import { appRouter, call, serverContext } from '@/lib/api'
import { getSession } from '@/lib/auth'

export default async function Home() {
  const context = await serverContext()
  const current = await call(appRouter.store.current, undefined, { context }).catch(() => null)
  if (!current) redirect('/select-store')
  const [summary, session] = await Promise.all([
    call(appRouter.dashboard.summary, undefined, { context }),
    getSession(),
  ])
  const firstName = (session?.user.name ?? 'there').trim().split(/\s+/)[0] ?? 'there'
  return <DashboardPage summary={summary} firstName={firstName} />
}
