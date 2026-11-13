import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type OverviewTileProps = {
  label: string
  /** Already formatted; null while loading draws a placeholder bar. */
  value: string | null
  note?: ReactNode
  /** A button beside the figure (the wallet's Recharge). */
  action?: ReactNode
  /** Warning edge for a low wallet. */
  attention?: boolean
}

/** One of the four tiles on Delhivery · Overview (Figma 928:11256): label, figure, one note line. */
export default function OverviewTile({
  label,
  value,
  note,
  action,
  attention = false,
}: OverviewTileProps) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col gap-1.5 rounded-xl border border-border surface-card p-4',
        attention && 'border-warning/40',
      )}
    >
      <h2 className="text-caption text-muted-foreground">{label}</h2>
      <div className="flex min-h-9 items-center justify-between gap-3">
        {value === null ? (
          <span className="h-6 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <p className="truncate text-[1.5rem] leading-8 font-semibold text-ink-strong tabular-nums">
            {value}
          </p>
        )}
        {action}
      </div>
      {note ? <p className="text-caption text-muted-foreground">{note}</p> : null}
    </section>
  )
}
