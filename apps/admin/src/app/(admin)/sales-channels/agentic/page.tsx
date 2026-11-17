import type { Metadata } from 'next'
import AgenticOverviewPage from '@/components/sales-channels/agentic-overview'
import ReadFailedPage from '@/components/sales-channels/read-failed-page'
import { failed, read } from '@/components/sales-channels/server-read'
import { salesChannelsContent } from '@/data/sales-channels'
import { salesChannelsLoadContent } from '@/data/sales-channels-load'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'

export const metadata: Metadata = { title: 'Agentic sales' }

export default async function Page() {
  const context = await serverContext()
  const [data, knowledge, copy, load] = await Promise.all([
    read(call(appRouter.salesChannels.agentic, undefined, { context })),
    read(call(appRouter.salesChannels.knowledge, undefined, { context })),
    getCopy(salesChannelsContent.unavailable),
    getCopy(salesChannelsLoadContent),
  ])

  if (failed(data)) {
    return <ReadFailedPage failure={data} heading={load.failed} noAccess={copy} />
  }
  return <AgenticOverviewPage data={data} knowledge={failed(knowledge) ? null : knowledge.counts} />
}
