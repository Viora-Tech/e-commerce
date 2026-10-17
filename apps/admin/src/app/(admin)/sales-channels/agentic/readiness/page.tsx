import { AgenticSales } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import ReadinessPage from '@/components/sales-channels/readiness-page'
import { salesChannelsContent } from '@/data/sales-channels'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'

export const metadata: Metadata = { title: 'Catalog readiness' }

export default async function Page() {
  const context = await serverContext()
  const [report, ai, copy] = await Promise.all([
    call(appRouter.salesChannels.readiness, undefined, { context }).catch(() => null),
    call(appRouter.ai.status, undefined, { context }).catch(() => null),
    getCopy(salesChannelsContent.unavailable),
  ])

  if (!report) return <SectionEmpty {...copy} icon={AgenticSales} />
  return <ReadinessPage report={report} aiBulk={ai?.bulkWriter ?? false} />
}
