import { type Permission, permissions } from '@commerce/core'
import { Palette } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import ThemePacksCard from '@/components/themes/theme-packs-card'
import ThemesLibrary from '@/components/themes/themes-library'
import { themesContent } from '@/data/themes'
import { appRouter, call, serverContext } from '@/lib/api'
import { storefrontOrigin } from '@/lib/storefront-origin'

export const metadata: Metadata = { title: 'Themes' }

export default async function Page() {
  const context = await serverContext()
  const [themes, me, packs] = await Promise.all([
    call(appRouter.themes.list, undefined, { context }).catch(() => null),
    call(appRouter.staff.me, {}, { context }).catch(() => null),
    call(appRouter.themes.packs, undefined, { context }).catch(() => null),
  ])

  if (!themes) return <SectionEmpty {...themesContent.unavailable} icon={Palette} />
  const granted = new Set<Permission>(me?.isOwner ? [] : (me?.permissions ?? []))
  const canPublish = me?.isOwner === true || granted.has(permissions.ONLINE_STORE_PUBLISH)
  // Theme packs (Zero Drift…) are a store setting: owners and administrators only.
  const canManagePacks =
    packs !== null && (me?.isOwner === true || granted.has(permissions.SETTINGS_MANAGE))
  return (
    <ThemesLibrary
      initial={themes}
      origin={await storefrontOrigin()}
      canPublish={canPublish}
      footer={canManagePacks ? <ThemePacksCard initial={packs} /> : null}
    />
  )
}
