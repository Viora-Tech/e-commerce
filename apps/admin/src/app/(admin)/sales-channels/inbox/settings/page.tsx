import type { Metadata } from 'next'
import InboxReadFailed from '@/components/inbox/inbox-read-failed'
import NotInstalled from '@/components/inbox/not-installed'
import SettingsPage from '@/components/inbox/settings-page'
import PageBody from '@/components/layout/page-body'
import { failed, read } from '@/components/sales-channels/server-read'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Inbox settings' }

export default async function Page() {
  const context = await serverContext()
  const view = await read(call(appRouter.inbox.settings.get, undefined, { context }))
  if (view === 'not-installed') return <NotInstalled />
  if (failed(view)) return <InboxReadFailed failure={view} />
  return (
    <PageBody>
      <SettingsPage settings={view.settings} timeZone={view.timeZone} />
    </PageBody>
  )
}
