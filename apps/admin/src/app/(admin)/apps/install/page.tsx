import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import InstalledApps from '@/components/apps/installed/installed-apps'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Install app' }

type Props = { searchParams: Promise<{ app?: string | string[] }> }

/**
 * `/apps/install?app=<pluginId>`: the install flow for one app in the store the member is in,
 * over the Installed apps list. The entry point for an outside app store: sign-in and store
 * choice happen first like any admin page, then the permissions are agreed to here.
 */
export default async function Page({ searchParams }: Props) {
  const { app } = await searchParams
  const id = Array.isArray(app) ? app[0] : app
  if (!id) redirect(routes.apps.list())
  return <InstalledApps installId={id} />
}
