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
  const [view, paid, apps] = await Promise.all([
    call(appRouter.billing.view, undefined, { context }),
    call(appRouter.billing.apps, undefined, { context }),
    call(appRouter.apps.list, undefined, { context }).catch(() => []),
  ])
  // A Koomerce store has nothing to choose.
  if (view.unlimited) redirect(routes.settings.billing())
  // Bought apps by name: "EMI & pay later stops billing separately" on the confirm.
  const boughtApps = Object.fromEntries(
    Object.entries(paid.access).flatMap(([id, a]) =>
      a.state === 'bought' ? [[id, apps.find((x) => x.id === id)?.name ?? id]] : [],
    ),
  )
  return <ChangePlanPage view={view} boughtApps={boughtApps} />
}
