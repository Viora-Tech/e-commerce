import type { Metadata } from 'next'
import NotInstalled from '@/components/inbox/not-installed'
import QuickRepliesPage from '@/components/inbox/quick-replies-page'
import PageBody from '@/components/layout/page-body'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Quick replies' }

export default async function Page() {
  const context = await serverContext()
  const installed = await call(appRouter.inbox.settings.get, undefined, { context })
    .then(() => true)
    .catch(() => false)
  if (!installed) return <NotInstalled />
  return (
    <PageBody>
      <QuickRepliesPage />
    </PageBody>
  )
}
