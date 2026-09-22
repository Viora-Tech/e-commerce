'use client'

import { cn } from '@commerce/ui/lib/utils'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { type NavItem, navigationContent } from '@/data/navigation'
import NavSection from './nav-section'

type NavGroupBlockProps = { label?: string | undefined; items: NavItem[]; pathname: string }

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar'

/** A labelled, collapsible group of rail entries (Cloudflare's "Observe" / "Build" blocks). */
export default function NavGroupBlock({ label, items, pathname }: NavGroupBlockProps) {
  // Hooks
  const [collapsed, setCollapsed] = useState(false)

  // Event handlers
  const handleToggle = () => {
    setCollapsed((c) => !c)
  }

  // Render logic
  const toggleLabel = label
    ? collapsed
      ? navigationContent.expandGroup(label)
      : navigationContent.collapseGroup(label)
    : undefined

  return (
    <div className="flex flex-col">
      {label ? (
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={toggleLabel}
          onClick={handleToggle}
          className={cn(
            'group/label mb-1 flex h-6 w-full items-center justify-between rounded px-5 text-left text-caption text-muted-foreground-soft transition-colors hover:text-foreground group-data-[collapsible=icon]:hidden',
            FOCUS,
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronDown
            className={cn(
              'size-3.5 opacity-0 transition-[opacity,transform] duration-200 group-hover/label:opacity-100',
              collapsed && '-rotate-90 opacity-100',
            )}
            strokeWidth={1.8}
          />
        </button>
      ) : null}
      {!collapsed ? (
        <ul className="flex flex-col gap-0.5 px-3 group-data-[collapsible=icon]:px-2">
          {items.map((item) => (
            <NavSection key={item.href} item={item} pathname={pathname} />
          ))}
        </ul>
      ) : null}
    </div>
  )
}
