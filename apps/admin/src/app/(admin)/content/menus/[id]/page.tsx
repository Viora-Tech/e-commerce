import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MenuEditor from '@/components/navigation/menu-editor'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Menus' }

type Props = { params: Promise<{ id: string }> }

export default async function Page({ params }: Props) {
  const { id } = await params
  const context = await serverContext()
  const menu = await call(appRouter.navigation.get, { id }, { context })
  if (!menu) notFound()
  return <MenuEditor menu={menu} />
}
