import { isInboxAvailable } from '@commerce/core/inbox'
import type { Metadata } from 'next'
import InboxHome from '@/components/inbox/inbox-home'
import NotInstalled from '@/components/inbox/not-installed'
import PageBody from '@/components/layout/page-body'
import { appRouter, call, serverContext } from '@/lib/api'
import { storefrontOrigin } from '@/lib/storefront-origin'

export const metadata: Metadata = { title: 'Inbox' }

export default async function Page() {
  const context = await serverContext()
  const view = await call(appRouter.inbox.settings.get, undefined, { context }).catch(() => null)
  if (!view) return <NotInstalled />
  const [counts, metrics, replies, storefrontUrl] = await Promise.all([
    call(appRouter.inbox.counts, undefined, { context }),
    call(appRouter.inbox.metrics, undefined, { context }),
    call(appRouter.inbox.quickReplies.list, undefined, { context }),
    storefrontOrigin(),
  ])
  return (
    <PageBody>
      <InboxHome
        settings={view.settings}
        availableNow={isInboxAvailable(view.settings, view.timeZone)}
        unread={counts.unread}
        quickReplies={replies.length}
        metrics={metrics}
        storefrontUrl={storefrontUrl}
      />
    </PageBody>
  )
}
