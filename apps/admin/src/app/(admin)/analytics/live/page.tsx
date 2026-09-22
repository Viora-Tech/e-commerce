import type { Metadata } from 'next'
import LiveView from '@/components/analytics/live-view'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Live view' }

export default async function Page() {
  const context = await serverContext()
  const live = await call(appRouter.analytics.live, undefined, { context })
  return <LiveView initial={live} />
}
