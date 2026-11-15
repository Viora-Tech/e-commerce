import type { Metadata } from 'next'
import ConversationsPage from '@/components/inbox/conversations/conversations-page'
import InboxReadFailed from '@/components/inbox/inbox-read-failed'
import NotInstalled from '@/components/inbox/not-installed'
import PageBody from '@/components/layout/page-body'
import { failed, read } from '@/components/sales-channels/server-read'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Conversations' }

type Props = { searchParams: Promise<{ id?: string | string[]; view?: string | string[] }> }

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : null)

export default async function Page({ searchParams }: Props) {
  const context = await serverContext()
  const view = await read(call(appRouter.inbox.settings.get, undefined, { context }))
  if (view === 'not-installed') return <NotInstalled />
  if (failed(view)) return <InboxReadFailed failure={view} />
  const params = await searchParams
  return (
    <PageBody>
      <ConversationsPage initialView={one(params.view)} initialId={one(params.id)} />
    </PageBody>
  )
}
