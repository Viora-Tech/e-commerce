'use client'

import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import { useState } from 'react'
import { layoutContent } from '@/data/layout'
import { activeChildHref, type NavChild } from '@/data/navigation'
import { useCopy } from '@/hooks/use-copy'

type NavAppPagesProps = {
  pages: NavChild[]
  pathname: string
}

/** Pages shown before "View more" (owner, 11 Nov 2026: three or four, then more). */
const SHOWN = 4

/**
 * An open app's own pages under its sidebar entry (Figma 928:10728): the app page then fills
 * the width instead of keeping a menu of its own. At most four, then View more; the page on
 * screen always shows, even past the fourth.
 */
export default function NavAppPages({ pages, pathname }: NavAppPagesProps) {
  // Hooks
  const copy = useCopy(layoutContent)
  const [all, setAll] = useState(false)

  // Render logic
  const active = activeChildHref(pathname, pages)
  const at = pages.findIndex((p) => p.href === active)
  const limit = all ? pages.length : Math.min(SHOWN, pages.length)
  const current = pages[at]
  const shown =
    at >= limit && current ? [...pages.slice(0, limit - 1), current] : pages.slice(0, limit)
  const more = pages.length - shown.length

  return (
    <ul className="relative mt-0.5 mb-1 ml-3 flex flex-col gap-0.5 pl-2.5 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-border">
      {shown.map((p) => (
        <li key={p.href}>
          <Link
            href={p.href}
            aria-current={p.href === active ? 'page' : undefined}
            className={cn(
              'flex h-6.5 min-w-0 items-center rounded-[0.375rem] px-2 text-caption text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
              p.href === active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
            )}
          >
            <span className="truncate">{p.label}</span>
          </Link>
        </li>
      ))}
      {more > 0 ? (
        <li>
          <button
            type="button"
            onClick={() => setAll(true)}
            className="flex h-6.5 w-full items-center rounded-[0.375rem] px-2 text-caption text-muted-foreground hover:text-sidebar-foreground"
          >
            {copy.viewMorePages(more)}
          </button>
        </li>
      ) : null}
    </ul>
  )
}
