'use client'

import { ChevronLeftIcon } from '@commerce/ui/icons'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SETTINGS_HOME, settingsContent } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'
import SettingsSearch from './settings-search'

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

/* Phones: the Settings home is the list, so a page only needs the way back to it. */
const BACK = `-ml-1 inline-flex h-9 items-center gap-1 self-start rounded-md pr-2 pl-1 text-nav text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-4 ${FOCUS}`

/**
 * Phones only. From `md` up the settings menu lives in the sidebar, which it takes over inside
 * Settings (`settings-sidebar-nav.tsx`). On phones the Settings home shows the search above its
 * list and every other page a "‹ Settings" back link.
 */
export default function SettingsNav() {
  // Hooks
  const copy = useCopy(settingsContent)
  const pathname = usePathname()

  // Render logic
  const onHome = pathname === SETTINGS_HOME.href

  return (
    <nav aria-label={copy.nav.label} className="flex w-full flex-col gap-3 md:hidden">
      {onHome ? (
        <SettingsSearch />
      ) : (
        <Link href={SETTINGS_HOME.href} className={BACK}>
          <ChevronLeftIcon aria-hidden="true" />
          {copy.nav.back}
        </Link>
      )}
    </nav>
  )
}
