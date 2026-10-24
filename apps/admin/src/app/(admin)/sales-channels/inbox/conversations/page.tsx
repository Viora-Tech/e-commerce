import type { Metadata } from 'next'
import ConversationsPage from '@/components/inbox/conversations/conversations-page'
import NotInstalled from '@/components/inbox/not-installed'
import PageBody from '@/components/layout/page-body'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Conversations' }

type Props = { searchParams: Promise<{ id?: string | string[]; view?: string | string[] }> }

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : null)

export default async function Page({ searchParams }: Props) {
  const context = await serverContext()
  const installed = await call(appRouter.inbox.settings.get, undefined, { context })
    .then(() => true)
    .catch(() => false)
  if (!installed) return <NotInstalled />
  const params = await searchParams
  return (
    <PageBody>
      <ConversationsPage initialView={one(params.view)} initialId={one(params.id)} />
    </PageBody>
  )
}
