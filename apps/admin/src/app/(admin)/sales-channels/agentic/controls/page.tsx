import { AgenticSales } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import ControlsPage from '@/components/sales-channels/controls-page'
import { salesChannelsContent } from '@/data/sales-channels'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'

export const metadata: Metadata = { title: 'Agent controls' }

export default async function Page() {
  const context = await serverContext()
  const [view, collections, copy] = await Promise.all([
    call(appRouter.salesChannels.controls, undefined, { context }).catch(() => null),
    call(appRouter.collections.list, undefined, { context }).catch(() => []),
    getCopy(salesChannelsContent.unavailable),
  ])

  if (!view) return <SectionEmpty {...copy} icon={AgenticSales} />
  return (
    <ControlsPage
      view={view}
      collections={collections.map((c) => ({ id: c.id, title: c.title }))}
    />
  )
}
