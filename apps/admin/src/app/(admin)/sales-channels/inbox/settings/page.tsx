import type { Metadata } from 'next'
import NotInstalled from '@/components/inbox/not-installed'
import SettingsPage from '@/components/inbox/settings-page'
import PageBody from '@/components/layout/page-body'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Inbox settings' }

export default async function Page() {
  const context = await serverContext()
  const view = await call(appRouter.inbox.settings.get, undefined, { context }).catch(() => null)
  if (!view) return <NotInstalled />
  return (
    <PageBody>
      <SettingsPage settings={view.settings} timeZone={view.timeZone} />
    </PageBody>
  )
}
