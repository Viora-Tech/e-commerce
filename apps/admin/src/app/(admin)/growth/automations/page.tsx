import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import AutomationsPage from '@/components/growth/automations/automations-page'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Automations' }

export default async function Page() {
  const context = await serverContext()
  // Cut over to the Automations engine: Growth's automations live in the app (Marketing filter).
  if ((await call(appRouter.marketing.automations.mode, undefined, { context })) === 'engine') {
    redirect(`${routes.apps.page('automations')}?origin=growth`)
  }
  const automations = await call(appRouter.marketing.automations.list, undefined, { context })
  return <AutomationsPage automations={automations} />
}
