'use client'

import { ChevronLeftIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  SETTINGS_GROUPS,
  SETTINGS_HOME,
  type SettingsSection,
  settingsContent,
} from '@/data/settings'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { Locale } from '@/lib/i18n'
import { instant, pill } from '@/lib/motion'
import { pageName } from '@/lib/page-names'
import { routes } from '@/lib/routes'
import SettingsSearch from './settings-search'

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

/* Proofly settings nav: 32px rows with the section's icon, the active one on a soft blue fill. */
const TAB = `relative isolate flex h-8 w-full min-w-0 items-center gap-2.5 rounded-[0.5rem] pr-3 pl-3 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground text-nav text-ink-strong transition-colors hover:bg-muted ${FOCUS}`
const TAB_ACTIVE =
  'text-sidebar-accent-foreground hover:bg-transparent [&_svg]:text-sidebar-accent-foreground'

/* Phones: the Settings home is the list, so a page only needs the way back to it. */
const BACK = `-ml-1 inline-flex h-9 items-center gap-1 self-start rounded-md pr-2 pl-1 text-nav text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-4 ${FOCUS}`

/** Each group short names first, so the rail reads as a tidy ragged edge (by the shown, translated name). */
function byNameLength(sections: readonly SettingsSection[], locale: Locale): SettingsSection[] {
  const name = (s: SettingsSection) => pageName(s.href, s.title, locale)
  return [...sections].sort((a, b) => name(a).length - name(b).length)
}

function isTabActive(pathname: string, href: string): boolean {
  // The settings home only lights up on itself, not on every page under it.
  if (href === SETTINGS_HOME.href) return pathname === href
  if (pathname !== href && !pathname.startsWith(`${href}/`)) return false
  // A page under another tab's address belongs to that tab only, so a parent tab does not light
  // up with it (audit #116).
  return !SETTINGS_GROUPS.some((g) =>
    g.sections.some(
      (s) =>
        s.href.length > href.length &&
        s.href.startsWith(`${href}/`) &&
        (pathname === s.href || pathname.startsWith(`${s.href}/`)),
    ),
  )
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
  const [approvals, setApprovals] = useState(0)

  // Approvals waiting for this member, plus outcomes of their own requests they have not seen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read when the page changes
  useEffect(() => {
    api.approvals
      .counts()
      .then((c) => setApprovals(c.waiting + c.outcomes))
      .catch(() => setApprovals(0))
  }, [pathname])

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
      <div className="hidden flex-col gap-5 md:flex">
        <ul className="flex flex-col gap-1">
          <NavTab section={SETTINGS_HOME} pathname={pathname} locale={locale} slide={slide} />
        </ul>
        {SETTINGS_GROUPS.map((group) => (
          <div key={group.id} className="flex flex-col gap-1.5">
            <p
              id={`settings-group-${group.id}`}
              className="px-3 text-caption text-muted-foreground"
            >
              {copy.groups[group.id]}
            </p>
            <ul aria-labelledby={`settings-group-${group.id}`} className="flex flex-col gap-1">
              {byNameLength(group.sections, locale).map((section) => (
                <NavTab
                  key={section.href}
                  section={section}
                  pathname={pathname}
                  locale={locale}
                  slide={slide}
                  count={section.href === routes.settings.approvals() ? approvals : 0}
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
  count?: number
}

function NavTab({ section, pathname, locale, slide, count = 0 }: NavTabProps) {
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
            className="absolute inset-0 -z-10 rounded-[0.5rem] bg-sidebar-accent"
            aria-hidden
          />
        ) : null}
        <section.icon aria-hidden="true" />
        <span className="min-w-0 truncate">{pageName(section.href, section.title, locale)}</span>
        {count > 0 ? (
          <span className="ml-auto rounded-full bg-primary px-1.5 text-caption text-primary-foreground tabular-nums">
            {count}
          </span>
        ) : null}
      </Link>
    </li>
  )
}
