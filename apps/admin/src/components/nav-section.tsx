'use client'

import { cn } from '@commerce/ui/lib/utils'
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import {
  isChildActive,
  isSectionActive,
  isSectionLinkActive,
  type NavItem,
  navigationContent,
} from '@/data/navigation'

type NavSectionProps = { item: NavItem; pathname: string }

/** A manual open/closed choice only holds for the route it was made on. */
type OpenOverride = { pathname: string; open: boolean }

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar'

/* Cloudflare rail: parent rows 32px with the icon left and a chevron right;
   children hang off a 1px guide line, indented under the icon column. */
const ROW = `group/row flex h-8 w-full min-w-0 items-center gap-2 rounded-[0.375rem] px-3 text-nav text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0 ${FOCUS}`
const ROW_ACTIVE =
  'bg-primary font-semibold text-primary-foreground hover:bg-primary hover:text-primary-foreground'
const ROW_OPEN = 'font-medium text-ink-strong'
const CHILD = `flex h-8 w-full min-w-0 items-center rounded-[0.375rem] px-3 text-nav text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground ${FOCUS}`
const CHILD_ACTIVE = 'bg-primary-soft font-medium text-ink-strong hover:bg-primary-soft'

/** One rail entry: the section link, a chevron toggle when it has sub-pages, and the guided child list. */
export default function NavSection({ item, pathname }: NavSectionProps) {
  // Hooks
  const [override, setOverride] = useState<OpenOverride | null>(null)

  // Event handlers
  const handleToggle = () => {
    setOverride({ pathname, open: !open })
  }

  // Render logic
  const children = item.children ?? []
  const sectionActive = isSectionActive(pathname, item)
  const linkActive = isSectionLinkActive(pathname, item)
  const open =
    children.length > 0 && (override?.pathname === pathname ? override.open : sectionActive)
  const toggleLabel = open
    ? navigationContent.collapseSection(item.label)
    : navigationContent.expandSection(item.label)

  return (
    <li className="flex flex-col">
      <div className="relative">
        <Link
          href={item.href}
          aria-current={linkActive ? 'page' : undefined}
          className={cn(
            ROW,
            linkActive && ROW_ACTIVE,
            open && !linkActive && ROW_OPEN,
            children.length > 0 && 'pr-9 group-data-[collapsible=icon]:pr-3',
          )}
        >
          <item.icon strokeWidth={1.8} />
          <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">
            {item.label}
          </span>
        </Link>
        {children.length > 0 ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={toggleLabel}
            onClick={handleToggle}
            className={cn(
              'absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground group-data-[collapsible=icon]:hidden',
              linkActive && 'text-primary-foreground/80 hover:text-primary-foreground',
              FOCUS,
            )}
          >
            <ChevronDown
              className={cn('size-4 transition-transform duration-200', open && 'rotate-180')}
              strokeWidth={1.8}
            />
          </button>
        ) : null}
      </div>
      {open ? (
        <ul className="mt-1 ml-[1.375rem] flex flex-col gap-0.5 border-border border-l pl-3 group-data-[collapsible=icon]:hidden">
          {children.map((child) => {
            const active = isChildActive(pathname, child)
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(CHILD, active && CHILD_ACTIVE)}
                >
                  <span className="min-w-0 flex-1 truncate">{child.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
    </li>
  )
}
