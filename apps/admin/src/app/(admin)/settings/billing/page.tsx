import type { Metadata } from 'next'
import type { BoughtApp } from '@/components/billing/apps-card'
import BillingPage from '@/components/billing/billing-page'
import { billingContent } from '@/data/billing'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy(billingContent)
  return { title: copy.title }
}

export default async function Page() {
  const context = await serverContext()
  const [view, paid, apps] = await Promise.all([
    call(appRouter.billing.view, undefined, { context }),
    call(appRouter.billing.apps, undefined, { context }),
    call(appRouter.apps.list, undefined, { context }).catch(() => []),
  ])
  // Paid apps bought on top of the plan, or with a bill waiting.
  const bought: BoughtApp[] = Object.entries(paid.access)
    .map(([id, access]) => ({
      id,
      name: apps.find((a) => a.id === id)?.name ?? id,
      access: access.state === 'bought' ? access : null,
      due: paid.bills.find((b) => b.pluginId === id && b.status === 'due') ?? null,
    }))
    .filter((a) => a.access || a.due)
  return <BillingPage view={view} apps={bought} />
}
