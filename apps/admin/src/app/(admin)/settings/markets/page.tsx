import type { Metadata } from 'next'
import MarketsSettings from '@/components/settings/markets/markets-settings'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Markets' }

export default async function Page() {
  const context = await serverContext()
  const [markets, domains] = await Promise.all([
    call(appRouter.markets.list, undefined, { context }),
    call(appRouter.domains.list, undefined, { context }),
  ])
  return <MarketsSettings markets={markets} domains={domains} />
}
