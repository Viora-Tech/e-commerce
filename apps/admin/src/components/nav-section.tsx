'use client'

import { ChevronRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useSidebar } from '@commerce/ui/shadcn/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useState } from 'react'
import {
  activeChildHref,
  isSectionActive,
  isSectionLinkActive,
  type NavItem,
  navigationContent,
} from '@/data/navigation'
import { useCopy } from '@/hooks/use-copy'
import { base, instant, pill } from '@/lib/motion'
import { SIDEBAR_CONTROL, SIDEBAR_LABEL } from '@/lib/sidebar-motion'

type NavSectionProps = {
  item: NavItem
  pathname: string
  /** The count pill (Figma "Sidebar menu button" › Count); hidden at 0. */
  count?: number | undefined
}

/** A manual open/closed choice only holds for the route it was made on. */
type OpenOverride = { pathname: string; open: boolean }

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar'

/* Figma "shadcn/Sidebar menu button": 32px rows, 8px sides, 8px gap, radius 6, a 16px icon in
   the sidebar ink and a muted chevron on the right. The active row is the sidebar-accent fill
   (a shared layout element, so it slides) with a medium-weight label. */
const ROW = `group/row relative isolate flex h-8 w-full min-w-0 items-center gap-2 overflow-hidden rounded-[0.375rem] px-2 text-body text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-sidebar-foreground ${FOCUS}`
const ROW_ACTIVE = 'font-medium hover:bg-transparent'
const ROW_OPEN = 'font-medium'
/* Figma "Sidebar sub item": 28px rows, 8px sides, radius 6, 14px muted text. */
const CHILD = `relative isolate flex h-7 w-full min-w-0 items-center rounded-[0.375rem] px-2 text-body text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground ${FOCUS}`
/* Figma "Sidebar sub item" active: the accent fill and medium label; the "|" rail beside it
   brightens for that row (owner: the marker sits on the rail, not inside the pill). */
const CHILD_ACTIVE =
  'font-medium text-sidebar-foreground hover:bg-transparent before:absolute before:inset-y-1 before:-left-2.5 before:w-0.5 before:rounded-full before:bg-sidebar-foreground'

/** One rail entry: the section link, a chevron toggle when it has sub-pages, and the guided child list. */
export default function NavSection({ item, pathname, count = 0 }: NavSectionProps) {
  // Hooks
  const copy = useCopy(navigationContent)
  const reduced = useReducedMotion()
  const { state: sidebarState, isMobile } = useSidebar()
  const [override, setOverride] = useState<OpenOverride | null>(null)

  // Event handlers
  const handleToggle = () => {
    setOverride({ pathname, open: !open })
  }

  // Render logic
  const children = item.children ?? []
  const sectionActive = isSectionActive(pathname, item)
  const linkActive = isSectionLinkActive(pathname, item)
  const activeHref = activeChildHref(pathname, children)
  const open =
    children.length > 0 && (override?.pathname === pathname ? override.open : sectionActive)
  const toggleLabel = open ? copy.collapseSection(item.label) : copy.expandSection(item.label)
  const slide = reduced ? instant : pill
  const reveal = reduced ? instant : base
  /* The collapsed rail shows icons only, so each one names itself in a tooltip (Figma rail). */
  const railTip = sidebarState === 'collapsed' && !isMobile
  const link = (
    <Link
      href={item.href}
      aria-current={linkActive ? 'page' : undefined}
      className={cn(
        ROW,
        linkActive && ROW_ACTIVE,
        open && !linkActive && ROW_OPEN,
        children.length > 0 && 'pr-9',
      )}
    >
      {linkActive ? (
        <motion.span
          layoutId="nav-active-pill"
          transition={slide}
          className="absolute inset-0 -z-10 rounded-[0.375rem] bg-sidebar-accent before:absolute before:inset-y-1.5 before:left-0 before:w-0.75 before:rounded-full before:bg-sidebar-foreground"
          aria-hidden
        />
      ) : sectionActive ? (
        /* Figma "Route=Orders": while one of its sub-pages is open the section row keeps the
             accent fill (the collapsed rail shows only this icon, so it carries it there too). */
        <span className="absolute inset-0 -z-10 rounded-[0.375rem] bg-sidebar-accent" aria-hidden />
      ) : null}
      <item.icon />
      <span className={cn('min-w-0 flex-1 truncate', SIDEBAR_LABEL)}>{item.label}</span>
      {count > 0 ? (
        <span
          title={copy.countHint(count)}
          className="flex h-4.5 min-w-5 shrink-0 items-center justify-center rounded-full bg-badge-count px-1.5 text-[0.6875rem] leading-3.5 font-semibold text-foreground tabular-nums group-data-[collapsible=icon]:hidden"
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  )

  return (
    <li className="flex flex-col">
      <div className="relative">
        {railTip ? (
          <Tooltip>
            <TooltipTrigger render={link} />
            <TooltipContent side="right" sideOffset={8}>
              {item.label}
            </TooltipContent>
          </Tooltip>
        ) : (
          link
        )}
        {children.length > 0 ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={toggleLabel}
            onClick={handleToggle}
            className={cn(
              'absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-[0.375rem] text-muted-foreground hover:text-sidebar-foreground',
              SIDEBAR_CONTROL,
              FOCUS,
            )}
          >
            <ChevronRight
              className={cn(
                'size-4 transition-transform duration-200 ease-out motion-reduce:transition-none',
                open && 'rotate-90',
              )}
            />
          </button>
        ) : null}
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.ul
            key="children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reveal}
            className="relative mt-1 ml-4 flex flex-col gap-0.5 overflow-hidden pl-2.5 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-border group-data-[collapsible=icon]:hidden"
          >
            {children.map((child) => {
              const active = child.href === activeHref
              return (
                <li key={child.href}>
                  <Link
                    href={child.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(CHILD, active && CHILD_ACTIVE)}
                  >
                    {active ? (
                      <motion.span
                        layoutId="nav-child-active-pill"
                        transition={slide}
                        className="absolute inset-0 -z-10 rounded-[0.375rem] bg-sidebar-accent"
                        aria-hidden
                      />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{child.label}</span>
                  </Link>
                </li>
              )
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </li>
  )
}
