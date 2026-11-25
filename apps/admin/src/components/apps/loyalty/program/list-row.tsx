import { ChevronDown, ChevronRight, Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import type { ReactNode } from 'react'

type ListRowProps = {
  /** A small tile before the label (rule or reward glyph). */
  icon?: ReactNode
  label: ReactNode
  /** A grey line under the label. */
  description?: ReactNode
  /** A chip right after the label ("Base rate", "On"). */
  badge?: ReactNode
  /** The row's value on the right ("8 points per ₹100", "Never"). */
  value?: ReactNode
  /** The raised white row (the first of a list). */
  raised?: boolean
  /** Opens a page: the row is a link with ›. */
  href?: string
  /** Opens an editor somewhere else: the row is a button with ›. */
  onOpen?: () => void
  /** Expands in place with a ⌄ (needs `children`). */
  open?: boolean
  onToggle?: () => void
  /** Shows + instead of ⌄ while closed (nothing set yet). */
  empty?: boolean
  /** A control on the right in place of the chevron (a switch); the row itself does nothing. */
  trailing?: ReactNode
  /** The body shown while `open`. */
  children?: ReactNode
}

const ROW =
  'flex w-full min-w-0 items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors'

/**
 * One row of a `ListSection`: icon, label and chip on the left, the value and a chevron on the
 * right. It links to a page, opens an editor, expands in place, or carries its own control.
 */
export default function ListRow({
  icon,
  label,
  description,
  badge,
  value,
  raised,
  href,
  onOpen,
  open,
  onToggle,
  empty,
  trailing,
  children,
}: ListRowProps) {
  // Render logic
  const inner = (
    <>
      {icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-body font-medium text-ink-strong">{label}</span>
          {badge}
        </span>
        {description ? (
          <span className="text-caption text-muted-foreground">{description}</span>
        ) : null}
      </span>
      {value !== undefined ? (
        <span className="shrink-0 text-body tabular-nums text-foreground">{value}</span>
      ) : null}
    </>
  )
  const glyph =
    href || onOpen ? (
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    ) : empty && !open ? (
      <Plus className="size-4 shrink-0 text-muted-foreground" />
    ) : (
      <ChevronDown
        className={cn(
          'size-4 shrink-0 text-muted-foreground transition-transform',
          open && 'rotate-180',
        )}
      />
    )
  const tint = raised ? 'bg-card shadow-xs' : ''
  const hover = raised ? 'hover:bg-card/80' : 'hover:bg-card/70'

  return (
    <li className={cn('flex flex-col rounded-md', tint)}>
      {trailing ? (
        <div className={ROW}>
          {inner}
          {trailing}
        </div>
      ) : href ? (
        <Link href={href} className={cn(ROW, hover)}>
          {inner}
          {glyph}
        </Link>
      ) : (
        <button
          type="button"
          aria-expanded={onToggle ? Boolean(open) : undefined}
          onClick={onOpen ?? onToggle}
          className={cn(ROW, hover)}
        >
          {inner}
          {glyph}
        </button>
      )}
      {open && children ? (
        <div className="flex flex-col gap-4 px-3 pt-1 pb-4">{children}</div>
      ) : null}
    </li>
  )
}
