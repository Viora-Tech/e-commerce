'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { affiliatePortalContent } from '@/data/affiliate-portal'

type SettingsNavProps = { base: string }

const copy = affiliatePortalContent.settings.tabs

const TABS = [
  { path: '/settings/profile', label: copy.profile },
  { path: '/settings/payout', label: copy.payout },
  { path: '/settings/notifications', label: copy.notifications },
  { path: '/settings/security', label: copy.security },
] as const

/**
 * Settings' sections as shadcn's forms example draws them: a list down the left on a wide
 * screen, a row that scrolls sideways on a phone. The open one has the muted fill.
 */
export default function SettingsNav({ base }: SettingsNavProps) {
  // Hooks
  const pathname = usePathname()

  // Render logic
  return (
    <nav
      className="-mx-1 overflow-x-auto [scrollbar-width:none] lg:mx-0 lg:w-1/5 lg:shrink-0 lg:overflow-visible"
      aria-label={affiliatePortalContent.settings.title}
    >
      <ul className="flex min-w-max gap-1 px-1 lg:min-w-0 lg:flex-col lg:px-0">
        {TABS.map((t) => {
          const href = `${base}${t.path}`
          const active = pathname === href
          return (
            <li key={t.path}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-9 w-full items-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors duration-(--duration-press) ${
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                {t.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
