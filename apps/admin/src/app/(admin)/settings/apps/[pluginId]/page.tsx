import { Puzzle } from '@commerce/ui/icons'
import { notFound, redirect } from 'next/navigation'
import { ADMIN_APPS } from '@/apps/registry'
import SettingsEmpty from '@/components/settings/settings-empty'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { appRouter, call, serverContext } from '@/lib/api'

type Params = { params: Promise<{ pluginId: string }> }

/** An installed app's settings page, from the admin app registry. */
export default async function AppSettingsPage({ params }: Params) {
  const { pluginId } = await params
  const Page = ADMIN_APPS[pluginId]?.SettingsPage
  if (!Page) notFound()
  const context = await serverContext()
  const apps = await call(appRouter.apps.list, undefined, { context }).catch(() => undefined)
  if (apps === undefined) redirect('/select-store')
  const app = apps.find((a) => a.id === pluginId)
  if (!app?.admin.settingsPage) notFound()
  if (!app.installed) {
    return (
      <SettingsEmpty
        heading={app.name}
        body={gstInvoicesContent.settings.notInstalled}
        action={{ label: gstInvoicesContent.settings.openApps, href: '/apps' }}
        icon={Puzzle}
      />
    )
  }
  return <Page />
}
