import { isInboxAvailable } from '@commerce/core/inbox'
import type { Metadata } from 'next'
import InboxHome from '@/components/inbox/inbox-home'
import InboxReadFailed from '@/components/inbox/inbox-read-failed'
import NotInstalled from '@/components/inbox/not-installed'
import PageBody from '@/components/layout/page-body'
import { failed, read } from '@/components/sales-channels/server-read'
import { appRouter, call, serverContext } from '@/lib/api'
import { storefrontOrigin } from '@/lib/storefront-origin'

export const metadata: Metadata = { title: 'Inbox' }

export default async function Page() {
  const context = await serverContext()
  const view = await read(call(appRouter.inbox.settings.get, undefined, { context }))
  if (view === 'not-installed') return <NotInstalled />
  if (failed(view)) return <InboxReadFailed failure={view} />
  const home = await read(
    Promise.all([
      call(appRouter.inbox.counts, undefined, { context }),
      call(appRouter.inbox.metrics, undefined, { context }),
      call(appRouter.inbox.quickReplies.list, undefined, { context }),
      storefrontOrigin(),
    ]),
  )
  if (failed(home)) return <InboxReadFailed failure={home} />
  const [counts, metrics, replies, storefrontUrl] = home
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
