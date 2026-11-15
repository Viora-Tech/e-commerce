import { type Permission, permissions } from '@commerce/core'
import type { Metadata } from 'next'
import ServerLoadFailed from '@/components/states/server-load-failed'
import ThemesLibrary from '@/components/themes/themes-library'
import { themesContent } from '@/data/themes'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'
import { didFail, loadFailure } from '@/lib/load-failure'
import { storefrontOrigin } from '@/lib/storefront-origin'

export const metadata: Metadata = { title: 'Themes' }

export default async function Page() {
  const context = await serverContext()
  const [themes, me, holds, prefs, performance] = await Promise.all([
    call(appRouter.themes.list, undefined, { context }).catch(loadFailure),
    call(appRouter.staff.me, {}, { context }).catch(() => null),
    // Members without Rollouts: read just see no chips.
    call(appRouter.rollouts.holds, undefined, { context }).catch(() => null),
    call(appRouter.store.getPreferences, undefined, { context }).catch(() => null),
    call(appRouter.themes.webPerformance, undefined, { context }).catch(() => null),
  ])

  if (didFail(themes)) {
    const copy = await getCopy(themesContent.library)
    return <ServerLoadFailed failed={themes.failed} heading={copy.loadFailed} />
  }
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
      performance={performance}
    />
  )
}
