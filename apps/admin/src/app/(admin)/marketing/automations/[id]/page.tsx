import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AutomationEditor from '@/components/marketing/automations/automation-editor'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Automation' }

type Props = { params: Promise<{ id: string }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function Page({ params }: Props) {
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const context = await serverContext()
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
