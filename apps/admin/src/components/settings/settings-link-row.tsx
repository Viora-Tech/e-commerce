import { ChevronRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import type { ReactNode } from 'react'

type SettingsLinkRowProps = {
  href: string
  title: ReactNode
  /** One quiet line under the title (status, address, what it holds). */
  description?: ReactNode
  /** The current value on the right, before the ›. */
  value?: ReactNode
  className?: string
}

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'

/**
 * One row of a settings list that opens its own page (a location, a domain, a role): title, a
 * quiet line, the current value and a ›, styled like the rows of `SettingsDrill` (#147). Put it
 * in a `ul` with `surface-card`, or in a row of your own beside a grip.
 */
export default function SettingsLinkRow({
  href,
  title,
  description,
  value,
  className,
}: SettingsLinkRowProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex min-w-0 flex-1 items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/60',
        FOCUS,
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-body font-medium text-ink-strong">
          {title}
        </span>
        {description ? (
          <span className="truncate text-caption text-muted-foreground">{description}</span>
        ) : null}
      </span>
      {value ? (
        <span className="max-w-[45%] truncate text-body text-muted-foreground">{value}</span>
      ) : null}
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
      />
    </Link>
  )
}
