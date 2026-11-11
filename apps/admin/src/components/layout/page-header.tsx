'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import { layoutContent } from '@/data/layout'
import { useCopy } from '@/hooks/use-copy'
import BackLink from './back-link'

/** The "‹ Parent" link: a route, or an in-page step back. */
export type PageHeaderBack =
  | { label: string; href: string }
  | { label: string; onClick: () => void }

type LeadTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral'

/** What sits before the title: a record tile or glyph, a person's avatar, or an app logo. */
export type PageHeaderLead = {
  kind: 'tile' | 'avatar' | 'logo' | 'icon'
  node: ReactNode
  /** Tints an `icon` lead when the record has a clear meaning, e.g. `success` for a fulfilled order. */
  tone?: LeadTone
}

type PageHeaderProps = {
  title: string
  /** The meta line under the title ("Placed 12 May, 9:15 pm"); a string or rich content. */
  subtitle?: ReactNode
  /** The plain-language line under the title ("72 products · 8 low on stock"). */
  summary?: ReactNode
  /** Small link above the title that leads back to the parent page (or, with `onClick`, closes
   *  an in-page detail such as an open settings row). */
  back?: PageHeaderBack
  /** The glyph, photo, avatar or logo before the title. */
  lead?: PageHeaderLead
  /** Status chips beside the title. */
  badges?: ReactNode
  /** Right-aligned buttons; icon buttons first, the one primary action last. */
  actions?: ReactNode
  /** The Save button after `actions`: dimmed until `dirty`. Leave it out for pages with no form. */
  save?: { dirty: boolean; saving?: boolean; onSave: () => void; label?: string }
  /** `md` draws a 48px tile lead (the default), `sm` a 40px one for denser record headers. */
  size?: 'md' | 'sm'
}

const TONE = {
  success: 'border-transparent bg-success-soft text-success',
  warning: 'border-transparent bg-warning-soft text-warning-foreground dark:text-warning',
  info: 'border-transparent bg-info-soft text-info',
  danger: 'border-transparent bg-danger-soft text-danger',
  neutral: 'border-border bg-card text-foreground',
} as const

const TILE = {
  md: 'size-12 rounded-xl border-border bg-primary-soft text-primary [&_svg]:size-6',
  sm: 'size-10 rounded-lg border-border bg-muted text-foreground shadow-input [&_svg]:size-5',
} as const

function leadClass(lead: PageHeaderLead, size: 'md' | 'sm'): string {
  switch (lead.kind) {
    case 'tile':
      return cn('flex shrink-0 items-center justify-center overflow-hidden border', TILE[size])
    case 'icon':
      return cn(
        'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border [&_svg]:size-4',
        TONE[lead.tone ?? 'neutral'],
      )
    case 'logo':
      return 'flex shrink-0 items-center justify-center overflow-hidden rounded-xl'
    case 'avatar':
      return 'flex shrink-0 items-center justify-center overflow-hidden rounded-full'
  }
}

/**
 * Title block every admin page starts with (Figma): the small "‹ Back" link, an optional lead
 * (tile, avatar, logo or icon), the large title with its chips, a plain line under it, and the
 * actions on the right, with Save last. Wraps on phones.
 */
export default function PageHeader({
  title,
  subtitle,
  summary,
  back,
  lead,
  badges,
  actions,
  save,
  size = 'md',
}: PageHeaderProps) {
  // Hooks
  const copy = useCopy(layoutContent)

  // Render logic
  const line = summary ?? subtitle

  return (
    <div className="flex flex-col gap-3">
      {back ? (
        'href' in back ? (
          <BackLink href={back.href} label={back.label} />
        ) : (
          <BackLink onClick={back.onClick} label={back.label} />
        )
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-[min(100%,16rem)] flex-1 items-start gap-4">
          {lead ? (
            <span
              aria-hidden={lead.kind === 'icon' ? true : undefined}
              className={leadClass(lead, size)}
            >
              {lead.node}
            </span>
          ) : null}
          <div className="flex min-w-0 flex-col gap-1">
            {/* One line: a long title truncates rather than pushing the chips onto the summary
                line, where a fixed-height copy of this row (the bug report picture) drew them
                on top of it (#804). */}
            <div className="flex min-w-0 items-center gap-x-3">
              <h1 title={title} className="min-w-0 truncate text-page-title text-ink-strong">
                {title}
              </h1>
              {badges ? <div className="flex shrink-0 items-center gap-1.5">{badges}</div> : null}
            </div>
            {line ? (
              <div className="text-body font-normal text-muted-foreground">{line}</div>
            ) : null}
          </div>
        </div>
        {actions || save ? (
          <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
            {actions}
            {save ? (
              <Button
                type="button"
                onClick={save.onSave}
                disabled={!save.dirty}
                loading={save.saving}
              >
                {save.label ?? copy.save}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
