'use client'

import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type OnlineStoreTabsProps = {
  active: 'themes' | 'preferences'
}

/** The Themes | Preferences switch under the page title (Figma "Online store / Themes"). */
export default function OnlineStoreTabs({ active }: OnlineStoreTabsProps) {
  // Hooks
  const tabs = useCopy(themesContent.tabs)

  // Render logic
  const items = [
    { id: 'themes', label: tabs.themes, href: routes.onlineStore.themes() },
    { id: 'preferences', label: tabs.preferences, href: routes.onlineStore.preferences() },
  ] as const

  return (
    <nav
      aria-label={tabs.label}
      className="inline-flex w-fit items-center gap-0.5 rounded-lg border border-hairline bg-chip-neutral p-0.5"
    >
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={active === item.id ? 'page' : undefined}
          className={cn(
            'flex h-7 items-center rounded-md px-3 text-body font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            active === item.id && 'bg-card text-foreground shadow-sm ring-1 ring-border',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
