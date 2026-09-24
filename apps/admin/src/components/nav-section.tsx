'use client'

import { ChevronDown } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useState } from 'react'
import {
  isChildActive,
  isSectionActive,
  isSectionLinkActive,
  type NavItem,
  navigationContent,
} from '@/data/navigation'
import { base, instant, pill } from '@/lib/motion'

type NavSectionProps = { item: NavItem; pathname: string }

/** A manual open/closed choice only holds for the route it was made on. */
type OpenOverride = { pathname: string; open: boolean }

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar'

/* Saleor-style rail: 32px rows, dark neutral text, icon left and chevron right;
   children are indented under the label, no guide line. The active row is a neutral pill (a shared
   layout element, so it slides) in ink, like Saleor's pressed list item. */
const ROW = `group/row relative isolate flex h-9 w-full min-w-0 items-center gap-2 rounded-[0.375rem] px-3 text-nav text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0 ${FOCUS}`
const ROW_ACTIVE =
  'text-sidebar-accent-foreground hover:bg-transparent hover:text-sidebar-accent-foreground'
const ROW_OPEN = 'font-medium text-ink-strong'
const CHILD = `relative isolate flex h-8 w-full min-w-0 items-center rounded-[0.375rem] px-3 text-nav text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground ${FOCUS}`
const CHILD_ACTIVE = 'text-sidebar-accent-foreground hover:bg-transparent'

/** One rail entry: the section link, a chevron toggle when it has sub-pages, and the guided child list. */
export default function NavSection({ item, pathname }: NavSectionProps) {
  // Hooks
  const reduced = useReducedMotion()
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
  const slide = reduced ? instant : pill
  const reveal = reduced ? instant : base

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
          {linkActive ? (
            <motion.span
              layoutId="nav-active-pill"
              transition={slide}
              className="absolute inset-0 -z-10 rounded-[0.375rem] bg-sidebar-accent"
              aria-hidden
            />
          ) : null}
          <item.icon weight={linkActive ? 'fill' : undefined} />
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
              linkActive && '[&_svg]:text-muted-foreground',
              FOCUS,
            )}
          >
            <ChevronDown
              className={cn(
                'size-4 transition-transform duration-200 ease-out motion-reduce:transition-none',
                open && 'rotate-180',
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
            className="ml-6 flex flex-col gap-0.5 overflow-hidden group-data-[collapsible=icon]:hidden"
          >
            {children.map((child, i) => {
              const active = isChildActive(pathname, child)
              return (
                <li key={child.href} className={cn(i === 0 && 'mt-1')}>
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
