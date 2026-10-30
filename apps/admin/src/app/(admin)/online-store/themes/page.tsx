import { type Permission, permissions } from '@commerce/core'
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
  const [themes, me, holds, prefs] = await Promise.all([
    call(appRouter.themes.list, undefined, { context }).catch(() => null),
    call(appRouter.staff.me, {}, { context }).catch(() => null),
    // Members without Rollouts: read just see no chips.
    call(appRouter.rollouts.holds, undefined, { context }).catch(() => null),
    call(appRouter.store.getPreferences, undefined, { context }).catch(() => null),
  ])

  if (!themes) return <SectionEmpty {...themesContent.unavailable} icon={Palette} />
  const granted = new Set<Permission>(me?.isOwner ? [] : (me?.permissions ?? []))
  const canPublish = me?.isOwner === true || granted.has(permissions.ONLINE_STORE_PUBLISH)
  // Theme packs (Zero Drift…), turned on per theme: owners and administrators only.
  const canManagePacks = me?.isOwner === true || granted.has(permissions.SETTINGS_MANAGE)
  return (
    <ThemesLibrary
      initial={themes}
      origin={await storefrontOrigin()}
      canPublish={canPublish}
      canManagePacks={canManagePacks}
      holds={holds?.themes}
      passwordOn={prefs?.password.enabled === true}
    />
  )
}
