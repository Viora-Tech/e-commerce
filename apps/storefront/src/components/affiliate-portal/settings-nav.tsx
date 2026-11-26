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

/** Settings' sections as a row of tabs (links), scrolling sideways on a phone. */
export default function SettingsNav({ base }: SettingsNavProps) {
  // Hooks
  const pathname = usePathname()

  // Render logic
  return (
    <nav
      className="-mx-1 overflow-x-auto border-b"
      aria-label={affiliatePortalContent.settings.title}
    >
      <ul className="flex min-w-max gap-1 px-1">
        {TABS.map((t) => {
          const href = `${base}${t.path}`
          const active = pathname === href
          return (
            <li key={t.path}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium transition-[color,border-color] duration-(--duration-press) ${
                  active
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
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
