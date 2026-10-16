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

  /* Figma "Group label": 36px tall (14px above the 12px label, 6px below), 8px in from the rows;
     rows sit 2px apart (4px on the collapsed rail, where the label folds away). */
  return (
    <nav
      aria-label={label}
      className={`flex flex-col gap-0.5 px-2.5 transition-[padding] group-data-[collapsible=icon]:px-2 ${SIDEBAR_DURATION}`}
    >
      {label ? (
        <p
          className={cn(
            'px-2 pt-3.5 pb-1.5 text-xs font-medium text-muted-foreground group-data-[collapsible=icon]:-mb-5',
            SIDEBAR_LABEL,
            'transition-[opacity,margin]',
          )}
        >
          {label}
        </p>
      ) : null}
      <ul className="flex flex-col gap-0.5 group-data-[collapsible=icon]:gap-1">
        {visible.map((item) => (
          <NavSection key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>
    </nav>
  )
}
