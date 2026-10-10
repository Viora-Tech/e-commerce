'use client'

import { ChevronLeftIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  SETTINGS_GROUPS,
  SETTINGS_HOME,
  type SettingsSection,
  settingsContent,
} from '@/data/settings'
import { useCopy, useLocale } from '@/hooks/use-copy'
import type { Locale } from '@/lib/i18n'
import { instant, pill } from '@/lib/motion'
import { pageName } from '@/lib/page-names'
import SettingsSearch from './settings-search'

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

/* Proofly settings nav: text-only 32px rows, the active one on a soft blue fill. */
const TAB = `relative isolate flex h-8 w-full min-w-0 items-center rounded-md px-3 text-nav text-ink-strong transition-colors hover:bg-muted ${FOCUS}`
const TAB_ACTIVE = 'text-sidebar-accent-foreground hover:bg-transparent'

/* Phones: the Settings home is the list, so a page only needs the way back to it. */
const BACK = `-ml-1 inline-flex h-9 items-center gap-1 self-start rounded-md pr-2 pl-1 text-nav text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-4 ${FOCUS}`

function isTabActive(pathname: string, href: string): boolean {
  // The settings home only lights up on itself, not on every page under it.
  if (href === SETTINGS_HOME.href) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * The settings rail. From `md` up: search, Overview, then the six groups under their headings,
 * the active page on a sliding pill. On phones the Settings home already lists every page, so
 * the home shows only the search and every other page shows a "‹ Settings" back link.
 */
export default function SettingsNav() {
  // Hooks
  const copy = useCopy(settingsContent)
  const locale = useLocale()
  const pathname = usePathname()
  const reduced = useReducedMotion()

  // Render logic
  const slide = reduced ? instant : pill
  const onHome = pathname === SETTINGS_HOME.href

  return (
    <nav
      aria-label={copy.nav.label}
      className="flex w-full flex-col gap-3 md:sticky md:top-6 md:max-h-[calc(100dvh-6rem)] md:w-[13.75rem] md:shrink-0 md:self-start md:overflow-y-auto md:no-scrollbar"
    >
      {onHome ? null : (
        <Link href={SETTINGS_HOME.href} className={cn(BACK, 'md:hidden')}>
          <ChevronLeftIcon aria-hidden="true" />
          {copy.nav.back}
        </Link>
      )}
      <div className={cn(onHome ? 'block' : 'hidden', 'md:block')}>
        <SettingsSearch />
      </div>
      <div className="hidden flex-col gap-3 md:flex">
        <ul className="flex flex-col">
          <NavTab section={SETTINGS_HOME} pathname={pathname} locale={locale} slide={slide} />
        </ul>
        {SETTINGS_GROUPS.map((group) => (
          <div key={group.id} className="flex flex-col gap-1">
            <p
              id={`settings-group-${group.id}`}
              className="px-3 text-caption text-muted-foreground"
            >
              {copy.groups[group.id]}
            </p>
            <ul aria-labelledby={`settings-group-${group.id}`} className="flex flex-col">
              {group.sections.map((section) => (
                <NavTab
                  key={section.href}
                  section={section}
                  pathname={pathname}
                  locale={locale}
                  slide={slide}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}

type NavTabProps = {
  section: SettingsSection
  pathname: string
  locale: Locale
  slide: typeof pill
}

function NavTab({ section, pathname, locale, slide }: NavTabProps) {
  // Render logic
  const active = isTabActive(pathname, section.href)

  return (
    <li>
      <Link
        href={section.href}
        aria-current={active ? 'page' : undefined}
        className={cn(TAB, active && TAB_ACTIVE)}
      >
        {active ? (
          <motion.span
            layoutId="settings-nav-pill"
            transition={slide}
            className="absolute inset-0 -z-10 rounded-md bg-sidebar-accent"
            aria-hidden
          />
        ) : null}
        <span className="min-w-0 truncate">{pageName(section.href, section.title, locale)}</span>
      </Link>
    </li>
  )
}
