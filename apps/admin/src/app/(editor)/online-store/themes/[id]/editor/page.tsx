import { loadEnv } from '@commerce/config'
import { permissions } from '@commerce/core'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ThemeCustomizer from '@/components/themes/theme-customizer'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Customize theme' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await serverContext()
  const [theme, me] = await Promise.all([
    call(appRouter.themes.get, { id }, { context }).catch(() => null),
    call(appRouter.staff.me, {}, { context }).catch(() => null),
  ])

  if (!theme) notFound()
  const canPublish =
    me?.isOwner === true || (me?.permissions ?? []).includes(permissions.ONLINE_STORE_PUBLISH)
  return (
    <ThemeCustomizer
      theme={theme}
      storefrontOrigin={new URL(loadEnv(process.env).STOREFRONT_URL).origin}
      canPublish={canPublish}
    />
  )
}
