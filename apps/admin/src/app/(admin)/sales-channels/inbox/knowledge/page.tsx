import type { Metadata } from 'next'
import KnowledgePage from '@/components/inbox/knowledge-page'
import NotInstalled from '@/components/inbox/not-installed'
import PageBody from '@/components/layout/page-body'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Knowledge base' }

export default async function Page() {
  const context = await serverContext()
  const view = await call(appRouter.inbox.settings.get, undefined, { context }).catch(() => null)
  if (!view) return <NotInstalled />
  return (
    <PageBody>
      <KnowledgePage aiOn={view.settings.ai.mode !== 'off'} />
    </PageBody>
  )
}
