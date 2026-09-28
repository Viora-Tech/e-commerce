'use client'

import { cn } from '@commerce/ui/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SETTINGS_HOME, SETTINGS_SECTIONS, settingsContent } from '@/data/settings'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { instant, pill } from '@/lib/motion'
import { pageName } from '@/lib/page-names'
import SettingsSearch from './settings-search'

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

/* CodeHelp's vertical tabs: 36px icon + label rows, active one on a soft
   rounded surface, the rest muted until hovered. */
const TAB = `relative isolate flex h-9 w-full min-w-0 items-center gap-2.5 rounded-[0.5rem] px-3 text-nav text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0 ${FOCUS}`
const TAB_ACTIVE = 'font-medium text-ink-strong hover:bg-transparent'

function isTabActive(pathname: string, href: string): boolean {
  // The settings home only lights up on itself, not on every page under it.
  if (href === SETTINGS_HOME.href) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

const TABS = [SETTINGS_HOME, ...SETTINGS_SECTIONS]

/** Left rail of the settings area: search, then one tab per section, active by route. */
export default function SettingsNav() {
  // Hooks
  const copy = useCopy(settingsContent)
  const locale = useLocale()
  const pathname = usePathname()
  const reduced = useReducedMotion()

  // Render logic
  const slide = reduced ? instant : pill

  return (
    <nav
      aria-label={copy.nav.label}
      className="flex w-full flex-col gap-3 md:sticky md:top-6 md:w-56 md:shrink-0 md:self-start"
    >
      <SettingsSearch />
      <ul className="flex flex-row gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {TABS.map((section) => {
          const active = isTabActive(pathname, section.href)
          return (
            <li key={section.href} className="shrink-0 md:shrink">
              <Link
                href={section.href}
                aria-current={active ? 'page' : undefined}
                className={cn(TAB, active && TAB_ACTIVE)}
              >
                {active ? (
                  <motion.span
                    layoutId="settings-nav-pill"
                    transition={slide}
                    className="absolute inset-0 -z-10 rounded-[0.5rem] bg-secondary"
                    aria-hidden
                  />
                ) : null}
                <section.icon />
                <span className="min-w-0 truncate">
                  {pageName(section.href, section.title, locale)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
