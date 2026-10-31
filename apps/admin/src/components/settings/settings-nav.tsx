'use client'

import { ChevronLeftIcon } from '@commerce/ui/icons'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { SETTINGS_HOME, settingsContent } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'
import SettingsSearch from './settings-search'

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

/* Phones: the Settings home is the list, so a page only needs the way back to it. */
const BACK = `-ml-1 inline-flex h-9 items-center gap-1 self-start rounded-md pr-2 pl-1 text-nav text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-4 ${FOCUS}`

/**
 * Phones only. From `md` up the settings menu is a column beside the page
 * (`settings-sidebar-nav.tsx`), so pages carry no "‹ Settings" link of their own (#191). On
 * phones the Settings home shows the search above its list and a top-level settings page a
 * "‹ Settings" back link. A deeper page (a zone, a role) and an open row detail (`?open=`) have
 * their own back link to the page above, so this one stays out of the way (#177).
 */
export default function SettingsNav() {
  // Hooks
  const copy = useCopy(settingsContent)
  const pathname = usePathname()
  const [openRow] = useQueryState('open')

  // Render logic
  const onHome = pathname === SETTINGS_HOME.href
  const ownBack = openRow !== null || pathname.split('/').filter(Boolean).length > 2

  // Early returns
  if (!onHome && ownBack) return null

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
