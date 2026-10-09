import { ChevronLeftIcon } from '@commerce/ui/icons'
import Link from 'next/link'
import type { ReactNode } from 'react'

type ProoflyPageHeaderProps = {
  title: string
  /** The plain-language line under the title ("72 products · 8 low on stock"). */
  summary?: ReactNode
  /** Small link above the title that leads back to the list. */
  back?: { label: string; href: string }
  /** Chips beside the title. */
  badges?: ReactNode
  /** Right-aligned buttons; the one primary action last. */
  actions?: ReactNode
  /** A 48px tile before the title (Figma product/order headers): a photo or an icon. */
  tile?: ReactNode
}

/** Page header from the Proofly frames: back link, Bricolage title, summary line, actions. */
export default function ProoflyPageHeader({
  title,
  summary,
  back,
  badges,
  actions,
  tile,
}: ProoflyPageHeaderProps) {
  // Render logic
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1">
        {back ? (
          <Link
            href={back.href}
            className="flex w-fit items-center gap-0.5 text-caption text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeftIcon className="size-4" aria-hidden />
            {back.label}
          </Link>
        ) : null}
        <div className="flex min-w-0 items-center gap-4">
          {tile ? (
            <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[0.75rem] border border-border bg-primary-soft text-primary [&_svg]:size-6">
              {tile}
            </span>
          ) : null}
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="min-w-0 truncate text-page-title text-ink-strong">{title}</h1>
              {badges}
            </div>
            {summary ? <p className="text-body text-muted-foreground">{summary}</p> : null}
          </div>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
