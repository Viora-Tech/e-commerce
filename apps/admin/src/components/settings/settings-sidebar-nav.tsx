'use client'

import { ArrowLeft } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
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
import { SIDEBAR_CONTROL, SIDEBAR_DURATION, SIDEBAR_LABEL } from '@/lib/sidebar-motion'
import SettingsSearch from './settings-search'

type SettingsSidebarNavProps = { pathname: string }

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar'

/* The same 32px rows as the main rail (nav-section.tsx), so entering Settings only swaps the
   list, not the look. */
const ROW = `relative isolate flex h-8 w-full min-w-0 items-center gap-2 overflow-hidden rounded-[0.375rem] px-2 text-body text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-sidebar-foreground ${FOCUS}`
const ROW_ACTIVE = 'font-medium hover:bg-transparent'

const BLOCK = `flex flex-col gap-0.5 px-2.5 transition-[padding] group-data-[collapsible=icon]:px-2 ${SIDEBAR_DURATION}`

/** Is `href` the settings page on screen? A deeper page owns its own address (audit #116). */
function isActive(pathname: string, href: string): boolean {
  if (href === SETTINGS_HOME.href) return pathname === href
  if (pathname !== href && !pathname.startsWith(`${href}/`)) return false
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
 * Settings' own menu (Shopify-style, #147): inside Settings it replaces the main rail, full
 * height, under the store switcher and domain. "Back to admin" on top, the settings search,
 * then Overview and the six groups. The active page sits on a sliding pill.
 */
export default function SettingsSidebarNav({ pathname }: SettingsSidebarNavProps) {
  // Hooks
  const copy = useCopy(settingsContent)
  const locale = useLocale()
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

  return (
    <nav aria-label={copy.nav.label} className="flex flex-col gap-0.5">
      <div className={cn(BLOCK, 'pt-1')}>
        <Link href={routes.home()} className={cn(ROW, 'text-muted-foreground')}>
          <ArrowLeft aria-hidden="true" />
          <span className={cn('min-w-0 truncate', SIDEBAR_LABEL)}>{copy.nav.exit}</span>
        </Link>
        <p
          className={cn(
            'px-2 pt-3 pb-1.5 text-body font-semibold text-sidebar-foreground',
            SIDEBAR_LABEL,
          )}
        >
          {copy.nav.title}
        </p>
        <div className={cn('pb-1', SIDEBAR_CONTROL)}>
          <SettingsSearch />
        </div>
        <ul className="flex flex-col gap-1">
          <SettingsRow section={SETTINGS_HOME} pathname={pathname} locale={locale} slide={slide} />
        </ul>
      </div>
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.id} className={BLOCK}>
          <p
            id={`settings-rail-${group.id}`}
            className={cn(
              'px-2 pt-3.5 pb-1.5 text-xs font-medium text-muted-foreground group-data-[collapsible=icon]:-mb-5',
              SIDEBAR_LABEL,
              'transition-[opacity,margin]',
            )}
          >
            {copy.groups[group.id]}
          </p>
          <ul aria-labelledby={`settings-rail-${group.id}`} className="flex flex-col gap-1">
            {group.sections.map((section) => (
              <SettingsRow
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
    </nav>
  )
}

type SettingsRowProps = {
  section: SettingsSection
  pathname: string
  locale: Locale
  slide: typeof pill
  count?: number
}

function SettingsRow({ section, pathname, locale, slide, count = 0 }: SettingsRowProps) {
  // Render logic
  const active = isActive(pathname, section.href)
  const name = pageName(section.href, section.title, locale)

  return (
    <li>
      <Link
        href={section.href}
        aria-current={active ? 'page' : undefined}
        aria-label={name}
        className={cn(ROW, active && ROW_ACTIVE)}
      >
        {active ? (
          <motion.span
            layoutId="settings-rail-pill"
            transition={slide}
            className="absolute inset-0 -z-10 rounded-[0.375rem] bg-sidebar-accent"
            aria-hidden
          />
        ) : null}
        <section.icon aria-hidden="true" />
        <span className={cn('min-w-0 flex-1 truncate', SIDEBAR_LABEL)}>{name}</span>
        {count > 0 ? (
          <span
            className={cn(
              'rounded-full bg-primary px-1.5 text-caption text-primary-foreground tabular-nums',
              SIDEBAR_CONTROL,
            )}
          >
            {count}
          </span>
        ) : null}
      </Link>
    </li>
  )
}
