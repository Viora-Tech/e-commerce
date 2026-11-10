import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import ChangePlanPage from '@/components/billing/change-plan-page'
import { billingContent } from '@/data/billing'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'
import { routes } from '@/lib/routes'

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy(billingContent)
  return { title: copy.changePlan.title }
}

/** Settings → Plan & billing → Change plan: the plans as a page (Figma 931:10521). */
export default async function Page() {
  const context = await serverContext()
  const view = await call(appRouter.billing.view, undefined, { context })
  // A Koomerce store has nothing to choose.
  if (view.unlimited) redirect(routes.settings.billing())
  return <ChangePlanPage view={view} />
}
