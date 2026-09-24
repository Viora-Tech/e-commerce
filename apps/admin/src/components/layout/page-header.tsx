import { ArrowLeft } from '@commerce/ui/icons'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { layoutContent } from '@/data/layout'

export type Crumb = { label: string; href?: string }

type PageHeaderProps = {
  title: string
  /** The meta line under the title ("Placed 12 May, 9:15 pm"); a string or rich content. */
  subtitle?: ReactNode
  /** The parent crumb with a link becomes the square back button left of the title. */
  breadcrumbs?: Crumb[]
  /** Right-aligned buttons; icon buttons first, the ink primary action last. */
  actions?: ReactNode
  /** Status pills beside the title (order status, product status). */
  badges?: ReactNode
  /** The record's glyph (an order box) in the square before the title, as in Saleor. The
   *  square still links back to the parent list; the arrow shows when no glyph is given. */
  icon?: ReactNode
  /** Kept for older call sites; both sizes draw the same header. */
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
 * a square outlined back button, the large regular-weight title with its status pills,
 * a small grey meta line under it, and the actions on the right. Wraps on phones.
 */
export default function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  badges,
  icon,
}: PageHeaderProps) {
  // Render logic
  const parent = parentOf(breadcrumbs)

  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
      <div className="flex min-w-[min(100%,16rem)] flex-1 items-start gap-4">
        {parent?.href ? (
          <Link
            href={parent.href}
            aria-label={layoutContent.backTo(parent.label)}
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground [&_svg]:size-4 transition-colors hover:border-border-strong hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {icon ?? <ArrowLeft className="size-4" strokeWidth={1.8} />}
          </Link>
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="truncate text-page-title text-ink-strong">{title}</h1>
            {badges ? <div className="flex flex-wrap items-center gap-1.5">{badges}</div> : null}
          </div>
          {subtitle ? (
            <div className="text-caption font-normal text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
