import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

export type TotalsLine = {
  label: ReactNode
  /** The figure, already formatted; an input works too for an editable line. */
  value: ReactNode
  /** Small grey note after the label ("estimated"); its own middle column with `columns`. */
  detail?: ReactNode
  /** Grey line: a part of a figure above it, or a note. */
  quiet?: boolean
  /** The bold line (total, balance); a rule is drawn above it. */
  strong?: boolean
  /** A rule above a line that is not bold: the start of a new group (what was paid). */
  rule?: boolean
  /** Red figure: a loss or an amount owed back. */
  negative?: boolean
}

type TotalsListProps = {
  lines: readonly TotalsLine[]
  /**
   * Three columns, after Shopify's order Payment card: label | muted note | amount, so the
   * notes ("2 items", the rate name, the code) line up instead of trailing each label.
   */
  columns?: boolean
  className?: string
}

/** The bill block: subtotal, shipping and the rest, then the bold total under a rule. */
export default function TotalsList({ lines, columns = false, className }: TotalsListProps) {
  return (
    <dl className={cn('flex flex-col gap-2 text-body', className)}>
      {lines.map((line, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: labels can repeat and are not always text.
          key={i}
          className={cn(
            columns
              ? 'grid grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto] items-center gap-3'
              : 'flex items-center justify-between gap-3',
            (line.strong || line.rule) && 'border-hairline border-t pt-2',
            line.strong && 'font-semibold text-ink-strong',
          )}
        >
          <dt className={cn(!line.strong && 'text-muted-foreground')}>
            {line.label}
            {line.detail && !columns ? (
              <span className="ml-1.5 text-caption text-muted-foreground">{line.detail}</span>
            ) : null}
          </dt>
          {columns ? (
            <span className="truncate text-caption font-normal text-muted-foreground">
              {line.detail}
            </span>
          ) : null}
          <dd
            className={cn(
              'tabular-nums',
              columns && 'text-right',
              line.quiet && 'text-muted-foreground',
              line.negative && 'text-danger',
            )}
          >
            {line.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
