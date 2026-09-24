'use client'

import { cn } from '@commerce/ui/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SETTINGS_SECTIONS, settingsContent } from '@/data/settings'
import { instant, pill } from '@/lib/motion'

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

/* CodeHelp's vertical tabs: 36px icon + label rows, active one on a soft
   rounded surface, the rest muted until hovered. */
const TAB = `relative isolate flex h-9 w-full min-w-0 items-center gap-2.5 rounded-[0.5rem] px-3 text-nav text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0 ${FOCUS}`
const TAB_ACTIVE = 'font-medium text-ink-strong hover:bg-transparent'

function isTabActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Left rail of the settings area: one tab per section, active by route. */
export default function SettingsNav() {
  // Hooks
  const pathname = usePathname()
  const reduced = useReducedMotion()

  // Render logic
  const slide = reduced ? instant : pill

  return (
    <nav
      aria-label={settingsContent.nav.label}
      className="w-full md:sticky md:top-6 md:w-56 md:shrink-0 md:self-start"
    >
      <ul className="flex flex-row gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {SETTINGS_SECTIONS.map((section) => {
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
                <span className="min-w-0 truncate">{section.title}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
