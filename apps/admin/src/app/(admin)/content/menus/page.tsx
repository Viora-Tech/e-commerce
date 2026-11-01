import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import NavigationList from '@/components/navigation/navigation-list'
import { appRouter, call, serverContext } from '@/lib/api'
import { orNoStore } from '@/lib/store-guard'

export const metadata: Metadata = { title: 'Menus' }

export default async function Page() {
  const context = await serverContext()
  const [menus, settings, themePlacements] = await Promise.all([
    call(appRouter.navigation.list, undefined, { context }),
    call(appRouter.navigation.settings, undefined, { context }),
    call(appRouter.navigation.themePlacements, undefined, { context }),
  ]).catch(orNoStore([undefined, undefined, undefined] as const))
  if (!menus || !settings || !themePlacements) redirect('/select-store')

  return (
    <NavigationList
      initialMenus={menus}
      initialSettings={settings}
      themePlacements={themePlacements}
    />
  )
}
