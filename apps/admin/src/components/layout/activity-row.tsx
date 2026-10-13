import { ChevronRight, type IconComponent } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import type { ReactNode } from 'react'
import IconBadge from './icon-badge'

type ActivityRowProps = {
  href: string
  icon: IconComponent
  tone: 'success' | 'warning' | 'info' | 'danger' | 'neutral'
  title: string
  /** Second line: what it means, or the amount. */
  detail?: ReactNode
  /** Right-hand side: the time for events, a chevron for things to act on. */
  aside?: ReactNode
  unread?: boolean
  onNavigate?: () => void
}

/** One line of the notifications panel: tinted icon, title, detail, and the time or a chevron. */
export default function ActivityRow({
  href,
  icon,
  tone,
  title,
  detail,
  aside,
  unread = false,
  onNavigate,
}: ActivityRowProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'group relative flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
        unread && 'bg-primary-soft/40',
      )}
    >
      <IconBadge icon={icon} tone={tone} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            'truncate text-body text-foreground',
            unread ? 'font-semibold' : 'font-medium',
          )}
        >
          {title}
        </span>
        {detail ? (
          <span className="line-clamp-2 text-caption text-muted-foreground">{detail}</span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-2 pt-0.5 text-caption text-muted-foreground">
        {aside ?? (
          <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        )}
        {unread ? <span aria-hidden="true" className="size-2 rounded-full bg-primary" /> : null}
      </span>
    </Link>
  )
}
