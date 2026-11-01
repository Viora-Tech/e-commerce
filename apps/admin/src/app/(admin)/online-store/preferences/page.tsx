import { SlidersHorizontal } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import PreferencesForm from '@/components/preferences/preferences-form'
import { preferencesContent } from '@/data/preferences'
import { appRouter, call, serverContext } from '@/lib/api'
import { getSession } from '@/lib/auth'
import { listStores } from '@/lib/shell-data'
import { storefrontOrigin } from '@/lib/storefront-origin'

export const metadata: Metadata = { title: 'Preferences' }

export default async function Page() {
  const context = await serverContext()
  const [prefs, session, stores] = await Promise.all([
    call(appRouter.store.getPreferences, undefined, { context }).catch(() => null),
    getSession(),
    listStores().catch(() => []),
  ])
  const activeId =
    (session?.session as { activeOrganizationId?: string | null } | undefined)
      ?.activeOrganizationId ?? null
  // A blank home page title falls back to this name on the storefront, so the previews use it too.
  const storeName = stores.find((s) => s.id === activeId)?.name ?? ''

  if (!prefs) return <SectionEmpty {...preferencesContent.unavailable} icon={SlidersHorizontal} />
  return (
    <PreferencesForm
      initial={prefs}
      storefrontOrigin={await storefrontOrigin()}
      storeName={storeName}
    />
  )
}
