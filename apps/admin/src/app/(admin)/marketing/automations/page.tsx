import type { Metadata } from 'next'
import AutomationsPage from '@/components/marketing/automations/automations-page'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Automations' }

export default async function Page() {
  const context = await serverContext()
  const automations = await call(appRouter.marketing.automations.list, undefined, { context })
  return <AutomationsPage automations={automations} />
}
