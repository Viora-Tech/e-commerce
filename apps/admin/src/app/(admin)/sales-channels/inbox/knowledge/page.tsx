import type { Metadata } from 'next'
import InboxReadFailed from '@/components/inbox/inbox-read-failed'
import KnowledgePage from '@/components/inbox/knowledge-page'
import NotInstalled from '@/components/inbox/not-installed'
import PageBody from '@/components/layout/page-body'
import { failed, read } from '@/components/sales-channels/server-read'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Knowledge base' }

export default async function Page() {
  const context = await serverContext()
  const view = await read(call(appRouter.inbox.settings.get, undefined, { context }))
  if (view === 'not-installed') return <NotInstalled />
  if (failed(view)) return <InboxReadFailed failure={view} />
  return (
    <PageBody>
      <KnowledgePage aiOn={view.settings.ai.mode !== 'off'} />
    </PageBody>
  )
}
