import { SlidersHorizontal } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SectionEmpty from '@/components/layout/section-empty'
import PreferencesForm from '@/components/preferences/preferences-form'
import { preferencesContent } from '@/data/preferences'
import { appRouter, call, serverContext } from '@/lib/api'
import { storefrontOrigin } from '@/lib/storefront-origin'

export const metadata: Metadata = { title: 'Preferences' }

export default async function Page() {
  const context = await serverContext()
  const prefs = await call(appRouter.store.getPreferences, undefined, { context }).catch(() => null)

  if (!prefs) return <SectionEmpty {...preferencesContent.unavailable} icon={SlidersHorizontal} />
  return <PreferencesForm initial={prefs} storefrontOrigin={await storefrontOrigin()} />
}
