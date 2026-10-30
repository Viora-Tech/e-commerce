import { ChevronRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import type { ReactNode } from 'react'

type SettingsLinkRowProps = {
  /** The page the row opens. */
  href?: string | undefined
  /** Or what a click does (opens a dialog). With neither, the row is plain text without a ›. */
  onClick?: (() => void) | undefined
  title: ReactNode
  /** One quiet line under the title (status, address, what it holds). */
  description?: ReactNode
  /** The current value on the right, before the ›. */
  value?: ReactNode
  /** An icon tile or picture before the title. */
  leading?: ReactNode
  className?: string | undefined
}

const ROW = 'group flex w-full min-w-0 flex-1 items-center gap-3 px-5 py-4 text-left'

const PRESSABLE =
  'transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'

/**
 * One row of a settings list that opens its own page or dialog (a location, a domain, an
 * expense): title, a quiet line, the current value and a ›, styled like the rows of
 * `SettingsDrill` (#147). Put it in a `SettingsList`, or in a row of your own beside a grip.
 */
export default function SettingsLinkRow({
  href,
  onClick,
  title,
  description,
  value,
  leading,
  className,
}: SettingsLinkRowProps) {
  // Render logic
  const pressable = href !== undefined || onClick !== undefined
  const body = (
    <>
      {leading}
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
      {pressable ? (
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
        />
      ) : null}
    </>
  )

  return href !== undefined ? (
    <Link href={href} className={cn(ROW, PRESSABLE, className)}>
      {body}
    </Link>
  ) : onClick ? (
    <button type="button" onClick={onClick} className={cn(ROW, PRESSABLE, className)}>
      {body}
    </button>
  ) : (
    <div className={cn(ROW, className)}>{body}</div>
  )
}
