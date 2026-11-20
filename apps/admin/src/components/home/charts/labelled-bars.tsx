type Bar = {
  key: string
  /** Shown in full: long names wrap onto a second line rather than being cut off. */
  label: string
  /** The figure on the right: "48%", "₹1,12,000". */
  value: string
  /** 0 to 1: how much of the track the bar fills. */
  share: number
}

type LabelledBarsProps = {
  bars: Bar[]
  /** Read out for the whole list, e.g. "How customers pay". */
  label: string
}

/**
 * Rows of label, figure and a thin bar under them (Figma "Home · Redesign 19 Nov": How customers
 * pay, Orders by status, Sales by state, Top products). Plain HTML, so the names are real text
 * that wraps, and nothing waits for a chart library to load.
 */
export default function LabelledBars({ bars, label }: LabelledBarsProps) {
  // Render logic
  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {bars.map((b) => (
        <li key={b.key} className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-3 text-caption">
            <span className="min-w-0 break-words text-ink-strong">{b.label}</span>
            <span className="shrink-0 font-semibold text-ink-strong tabular-nums">{b.value}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground"
              style={{ width: `${Math.max(0, Math.min(1, b.share)) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
