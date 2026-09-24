'use client'

import type { NavItem } from '@/data/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import NavSection from './nav-section'

type NavGroupBlockProps = {
  /** The group's name, for screen readers only: the rail shows items, not group labels. */
  label?: string | undefined
  items: NavItem[]
  pathname: string
}

/**
 * One logical group of rail entries. Like the Saleor Dashboard sidebar it draws no label:
 * groups are told apart by the gap between them, and each item expands to its sub-pages.
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
      <ul className="flex flex-col gap-0.5 px-3 group-data-[collapsible=icon]:px-2">
        {visible.map((item) => (
          <NavSection key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>
    </nav>
  )
}
