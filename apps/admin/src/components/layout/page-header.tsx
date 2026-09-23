import { ArrowLeft } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'
import { layoutContent } from '@/data/layout'

export type Crumb = { label: string; href?: string }

type PageHeaderProps = {
  title: string
  subtitle?: string
  breadcrumbs?: Crumb[]
  /** Right-aligned buttons; primary action last. */
  actions?: ReactNode
  /** Status badges or meta shown beside the title (order status, product status). */
  badges?: ReactNode
  /** Kept for older call sites; both sizes now draw the same header. */
  size?: 'compact' | 'frame'
}

/** The nearest crumb with a link: where the back button goes. */
function parentOf(crumbs: Crumb[] | undefined): Crumb | null {
  if (!crumbs) return null
  for (let i = crumbs.length - 1; i >= 0; i--) {
    if (crumbs[i]?.href) return crumbs[i] ?? null
  }
  return null
}

/**
 * Title row every admin page starts with, after the Saleor Dashboard top nav (BSD-3):
 * a back button to the parent list, the linked trail as a small eyebrow, the title,
 * then actions on the right. Wraps under the title on narrow screens.
 */
export default function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  badges,
}: PageHeaderProps) {
  // Render logic
  const parent = parentOf(breadcrumbs)
  const trail = (breadcrumbs ?? []).filter((c) => c.href)

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex min-w-[min(100%,16rem)] flex-1 items-center gap-3">
        {parent?.href ? (
          <Link
            href={parent.href}
            aria-label={layoutContent.backTo(parent.label)}
            className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" strokeWidth={1.8} />
          </Link>
        ) : null}
        <div className="flex min-w-0 flex-col">
          {trail.length > 0 ? (
            <nav aria-label={layoutContent.breadcrumb} className="flex min-w-0 items-center gap-1">
              {trail.map((c, i) => (
                <Fragment key={`${c.label}-${c.href}`}>
                  {i > 0 ? (
                    <span aria-hidden className="text-caption text-muted-foreground-soft">
                      /
                    </span>
                  ) : null}
                  <Link
                    href={c.href ?? '/'}
                    className="truncate text-caption text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {c.label}
                  </Link>
                </Fragment>
              ))}
            </nav>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="truncate text-page-title text-ink-strong">{title}</h1>
            {badges ? <div className="flex flex-wrap items-center gap-1.5">{badges}</div> : null}
          </div>
          {subtitle ? (
            <p className={cn('text-body text-muted-foreground', trail.length === 0 && 'mt-0.5')}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
