import { permissions } from '@commerce/core'
import { Palette } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import ThemesLibrary from '@/components/themes/themes-library'
import { themesContent } from '@/data/themes'
import { appRouter, call, serverContext } from '@/lib/api'
import { storefrontOrigin } from '@/lib/storefront-origin'

export const metadata: Metadata = { title: 'Themes' }

export default async function Page() {
  const context = await serverContext()
  const [themes, me] = await Promise.all([
    call(appRouter.themes.list, undefined, { context }).catch(() => null),
    call(appRouter.staff.me, {}, { context }).catch(() => null),
  ])

  if (!themes) return <SectionEmpty {...themesContent.unavailable} icon={Palette} />
  const canPublish =
    me?.isOwner === true || (me?.permissions ?? []).includes(permissions.ONLINE_STORE_PUBLISH)
  return (
    <ThemesLibrary initial={themes} origin={await storefrontOrigin()} canPublish={canPublish} />
  )
}
