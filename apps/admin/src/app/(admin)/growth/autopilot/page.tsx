import type { Metadata } from 'next'
import AutopilotPage from '@/components/growth/autopilot/autopilot-page'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Autopilot' }

export default async function Page() {
  const context = await serverContext()
  const view = await call(appRouter.marketing.autopilot.get, undefined, { context })
  return <AutopilotPage initial={view} />
}
