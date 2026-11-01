import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import AutomationEditor from '@/components/growth/automations/automation-editor'
import { appRouter, call, serverContext } from '@/lib/api'
import { automationRoutes } from '@/lib/automation-routes'

type Props = { params: Promise<{ id: string }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  if (!UUID.test(id)) return { title: 'Automation' }
  const context = await serverContext()
  const automation = await call(appRouter.marketing.automations.get, { id }, { context }).catch(
    () => null,
  )
  return { title: automation?.name || 'Automation' }
}

export default async function Page({ params }: Props) {
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const context = await serverContext()
  // Cut over to the Automations engine: the workflow keeps its id and opens in the app's editor.
  if ((await call(appRouter.marketing.automations.mode, undefined, { context })) === 'engine') {
    redirect(automationRoutes.workflow(id))
  }
  const [automation, setup] = await Promise.all([
    call(appRouter.marketing.automations.get, { id }, { context }),
    call(appRouter.marketing.setup, undefined, { context }),
  ])
  if (!automation) notFound()
  return (
    <AutomationEditor
      key={automation.updatedAt.toString()}
      automation={automation}
      storeName={setup.storeName}
      storefrontUrl={setup.storefrontUrl}
    />
  )
}
