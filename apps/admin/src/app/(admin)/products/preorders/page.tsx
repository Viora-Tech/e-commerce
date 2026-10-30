import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import PreordersOverview from '@/components/preorders/preorders-overview'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { orNoStore } from '@/lib/store-guard'

export const metadata: Metadata = { title: 'Pre-orders' }

export default async function Page() {
  const context = await serverContext()
  const overview = await call(appRouter.preorders.overview, undefined, { context }).catch(
    orNoStore(undefined),
  )
  if (overview === undefined) redirect(routes.selectStore())
  return <PreordersOverview overview={overview} />
}
