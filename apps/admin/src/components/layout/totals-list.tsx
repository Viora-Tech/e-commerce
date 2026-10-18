import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

export type TotalsLine = {
  label: ReactNode
  /** The figure, already formatted; an input works too for an editable line. */
  value: ReactNode
  /** Small grey note after the label ("estimated"). */
  detail?: ReactNode
  /** Grey line: a part of a figure above it, or a note. */
  quiet?: boolean
  /** The bold line (total, balance); a rule is drawn above it. */
  strong?: boolean
  /** Red figure: a loss or an amount owed back. */
  negative?: boolean
}

type TotalsListProps = {
  lines: readonly TotalsLine[]
  className?: string
}

/** The bill block: subtotal, shipping and the rest, then the bold total under a rule. */
export default function TotalsList({ lines, className }: TotalsListProps) {
  return (
    <dl className={cn('flex flex-col gap-2 text-body', className)}>
      {lines.map((line, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: labels can repeat and are not always text.
          key={i}
          className={cn(
            'flex items-center justify-between gap-3',
            line.strong && 'border-hairline border-t pt-2 font-semibold text-ink-strong',
          )}
        >
          <dt className={cn(!line.strong && 'text-muted-foreground')}>
            {line.label}
            {line.detail ? (
              <span className="ml-1.5 text-caption text-muted-foreground">{line.detail}</span>
            ) : null}
          </dt>
          <dd
            className={cn(
              'tabular-nums',
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
