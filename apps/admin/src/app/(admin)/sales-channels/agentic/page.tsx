import { AgenticSales } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import AgenticOverviewPage from '@/components/sales-channels/agentic-overview'
import { salesChannelsContent } from '@/data/sales-channels'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'

export const metadata: Metadata = { title: 'Agentic sales' }

export default async function Page() {
  const context = await serverContext()
  const [data, copy] = await Promise.all([
    call(appRouter.salesChannels.agentic, undefined, { context }).catch(() => null),
    getCopy(salesChannelsContent.unavailable),
  ])

  if (!data) return <SectionEmpty {...copy} icon={AgenticSales} />
  return <AgenticOverviewPage data={data} />
}
