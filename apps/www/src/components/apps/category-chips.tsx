import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import { categoryCopy, categoryPath, appsContent as copy } from '@/data/apps'

type CategoryChipsProps = {
  categories: { slug: string; count: number }[]
  /** The category page this is on, or null on the directory. */
  current: string | null
  /** The search to carry over, so switching category keeps what was typed. */
  query: string
}

const CHIP =
  'inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap outline-none transition-[background-color,color,scale] duration-(--duration-press) ease-out focus-visible:ring-3 focus-visible:ring-ring/60 active:scale-(--motion-press-scale)'

/**
 * Category chips. Each is a link to that category's own static page (so search engines list
 * it), carrying the search over; on a phone the row scrolls sideways instead of wrapping.
 */
export default function CategoryChips({ categories, current, query }: CategoryChipsProps) {
  // Render logic
  const search = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''
  const total = categories.reduce((sum, c) => sum + c.count, 0)
  const chips = [
    { slug: null, label: copy.allApps, count: total, href: `/apps${search}` },
    ...categories.map((c) => ({
      slug: c.slug,
      label: categoryCopy(c.slug).label,
      count: c.count,
      href: `${categoryPath(c.slug)}${search}`,
    })),
  ]

  return (
    <nav aria-label={copy.categoriesLabel} className="-mx-4 min-w-0 md:mx-0">
      <ul className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-1 md:flex-wrap md:overflow-visible md:px-0">
        {chips.map((chip) => {
          const active = chip.slug === current
          return (
            <li key={chip.slug ?? 'all'}>
              <Link
                href={chip.href}
                scroll={false}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  CHIP,
                  active
                    ? 'bg-foreground text-background'
                    : 'bg-foreground/5 text-muted-foreground ring-1 ring-border ring-inset hover:bg-foreground/10 hover:text-foreground',
                )}
              >
                {chip.label}
                <span className={cn('text-xs tabular-nums', active ? 'opacity-60' : 'opacity-70')}>
                  {chip.count}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
