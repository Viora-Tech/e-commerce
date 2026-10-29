import type { Metadata } from 'next'
import StoreHealthPage from '@/components/store-health/store-health-page'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Store health' }

/** Settings → Store health: the server runs the first check, the page can run it again. */
export default async function Page() {
  const context = await serverContext()
  const report = await call(appRouter.store.health, undefined, { context }).catch(() => null)
  return <StoreHealthPage initial={report} />
}
