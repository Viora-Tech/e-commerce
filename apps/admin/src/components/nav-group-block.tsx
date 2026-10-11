'use client'

import { cn } from '@commerce/ui/lib/utils'
import type { NavItem } from '@/data/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { SIDEBAR_DURATION, SIDEBAR_LABEL } from '@/lib/sidebar-motion'
import NavSection from './nav-section'

type NavGroupBlockProps = {
  /** The group's name: announced to screen readers and shown small above its items. */
  label?: string | undefined
  items: NavItem[]
  pathname: string
}

/**
 * One named group of rail entries (Workspace, Sales channels, Apps, Settings); each item
 * expands in place to its sub-pages.
 */
export default function NavGroupBlock({ label, items, pathname }: NavGroupBlockProps) {
  // Hooks
  const { loading, hasPermission } = usePermissions()

  // Early returns
  /* Hiding is a convenience: every page and procedure checks on the server too.
     While permissions load, show the rail rather than flashing an empty one. */
  const visible = loading
    ? items
    : items
        .filter((item) => !item.permission || hasPermission(item.permission))
        .map((item) => ({
          ...item,
          children: item.children?.filter((c) => !c.permission || hasPermission(c.permission)),
        }))
  if (visible.length === 0) return null

  return (
    <nav aria-label={label}>
      {label ? (
        <p
          className={cn(
            'mb-1 px-6 text-caption font-normal text-muted-foreground-soft group-data-[collapsible=icon]:mb-[-1.125rem]',
            SIDEBAR_LABEL,
            'transition-[opacity,margin]',
          )}
        >
          {label}
        </p>
      ) : null}
      <ul
        className={`flex flex-col gap-1 px-4 transition-[padding] group-data-[collapsible=icon]:px-2 ${SIDEBAR_DURATION}`}
      >
        {visible.map((item) => (
          <NavSection key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>
    </nav>
  )
}
