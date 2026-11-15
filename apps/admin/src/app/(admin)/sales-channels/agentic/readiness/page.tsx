import type { Metadata } from 'next'
import ReadFailedPage from '@/components/sales-channels/read-failed-page'
import ReadinessPage from '@/components/sales-channels/readiness-page'
import { failed, read } from '@/components/sales-channels/server-read'
import { salesChannelsContent } from '@/data/sales-channels'
import { salesChannelsLoadContent } from '@/data/sales-channels-load'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'

export const metadata: Metadata = { title: 'Catalog readiness' }

export default async function Page() {
  const context = await serverContext()
  const [report, ai, copy, load] = await Promise.all([
    read(call(appRouter.salesChannels.readiness, undefined, { context })),
    call(appRouter.ai.status, undefined, { context }).catch(() => null),
    getCopy(salesChannelsContent.unavailable),
    getCopy(salesChannelsLoadContent),
  ])

  if (failed(report)) {
    return <ReadFailedPage failure={report} heading={load.failed} noAccess={copy} />
  }
  return <ReadinessPage report={report} aiBulk={ai?.bulkWriter ?? false} />
}
