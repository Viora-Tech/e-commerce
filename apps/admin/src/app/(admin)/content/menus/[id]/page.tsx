import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MenuEditor from '@/components/navigation/menu-editor'
import { placementsFor } from '@/components/navigation/placements'
import { appRouter, call, serverContext } from '@/lib/api'
import { orMissing } from '@/lib/store-guard'

export const metadata: Metadata = { title: 'Menus' }

type Props = { params: Promise<{ id: string }> }

export default async function Page({ params }: Props) {
  const { id } = await params
  const context = await serverContext()
  const [menu, settings, themePlacements] = await Promise.all([
    call(appRouter.navigation.get, { id }, { context }).catch(orMissing),
    call(appRouter.navigation.settings, undefined, { context }),
    call(appRouter.navigation.themePlacements, undefined, { context }),
  ])
  if (!menu) notFound()
  return (
    <MenuEditor menu={menu} placements={placementsFor(menu.handle, settings, themePlacements)} />
  )
}
