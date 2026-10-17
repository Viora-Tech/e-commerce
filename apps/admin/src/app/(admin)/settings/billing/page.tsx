import type { Metadata } from 'next'
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
  const view = await call(appRouter.billing.view, undefined, { context })
  return <BillingPage view={view} />
}
