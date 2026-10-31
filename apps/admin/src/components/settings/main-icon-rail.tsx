'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import Link from 'next/link'
import { type NavItem, navigationContent } from '@/data/navigation'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'

type MainIconRailProps = {
  /** The main menu's top-level items, already localized, Settings last. */
  items: NavItem[]
  pathname: string
}

/** Is `href` the section on screen? Home matches only itself. */
function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * The main menu as a slim icon column beside the Settings menu (Shopify-style, owner
 * 2026-10-31): inside Settings every admin section stays one click away, each named in a
 * tooltip. Hidden while the sidebar is collapsed to its own icon rail.
 */
export default function MainIconRail({ items, pathname }: MainIconRailProps) {
  // Hooks
  const copy = useCopy(navigationContent)
  const { loading, hasPermission } = usePermissions()

  // Render logic
  // Hiding is a convenience: every page checks on the server too.
  const visible = loading
    ? items
    : items.filter((item) => !item.permission || hasPermission(item.permission))

  return (
    <nav
      aria-label={copy.mainMenu}
      className="flex w-11 shrink-0 flex-col items-center gap-1 border-hairline border-r pt-1 group-data-[collapsible=icon]:hidden"
    >
      {visible.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Tooltip key={item.href}>
            <TooltipTrigger
              render={
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-[0.375rem] text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active && 'bg-sidebar-accent text-sidebar-foreground',
                  )}
                />
              }
            >
              <item.icon aria-hidden="true" className={cn('size-4', item.iconClassName)} />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {item.label}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </nav>
  )
}
