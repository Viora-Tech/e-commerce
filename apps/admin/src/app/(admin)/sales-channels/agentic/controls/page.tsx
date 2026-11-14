import type { Metadata } from 'next'
import ControlsPage from '@/components/sales-channels/controls-page'
import ReadFailedPage from '@/components/sales-channels/read-failed-page'
import { failed, read } from '@/components/sales-channels/server-read'
import { salesChannelsContent } from '@/data/sales-channels'
import { salesChannelsLoadContent } from '@/data/sales-channels-load'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'

export const metadata: Metadata = { title: 'Agent controls' }

export default async function Page() {
  const context = await serverContext()
  const [view, collections, copy, load] = await Promise.all([
    read(call(appRouter.salesChannels.controls, undefined, { context })),
    call(appRouter.collections.list, undefined, { context }).catch(() => []),
    getCopy(salesChannelsContent.unavailable),
    getCopy(salesChannelsLoadContent),
  ])

  if (failed(view)) {
    return <ReadFailedPage failure={view} heading={load.failed} noAccess={copy} />
  }
  return (
    <ControlsPage
      view={view}
      collections={collections.map((c) => ({ id: c.id, title: c.title }))}
    />
  )
}
