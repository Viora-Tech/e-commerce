import { ArrowLeft } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
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
  /** The record's glyph (an order box) in the square before the title, as in Saleor. When a
   *  breadcrumb parent has a link, the square doubles as the back button (the arrow shows when
   *  no glyph is given); with no parent link it's a plain icon badge, e.g. a settings section. */
  icon?: ReactNode
  /** Tints the icon square (a soft badge instead of a plain outline) when the record has a
   *  clear meaning, e.g. `success` for a fulfilled order. Neutral (the default) keeps the
   *  plain bordered square. */
  tone?: 'success' | 'warning' | 'info' | 'danger' | 'neutral'
  /** Kept for older call sites; both sizes draw the same header. */
  size?: 'compact' | 'frame'
}

const TONE = {
  success: 'border-transparent bg-success-soft text-success',
  warning: 'border-transparent bg-warning-soft text-warning-foreground dark:text-warning',
  info: 'border-transparent bg-info-soft text-info',
  danger: 'border-transparent bg-danger-soft text-danger',
  neutral: 'border-border bg-card text-foreground hover:border-border-strong hover:bg-muted/60',
} as const

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
  tone = 'neutral',
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
            className={cn(
              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border [&_svg]:size-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              TONE[tone],
            )}
          >
            {icon ?? <ArrowLeft className="size-4" />}
          </Link>
        ) : icon ? (
          <span
            aria-hidden="true"
            className={cn(
              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border [&_svg]:size-4',
              TONE[tone],
            )}
          >
            {icon}
          </span>
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
