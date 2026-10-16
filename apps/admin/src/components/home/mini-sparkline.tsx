import { cn } from '@commerce/ui/lib/utils'

type MiniSparklineProps = {
  /** Real points when the page already loaded them; otherwise a quiet decorative line. */
  values: number[]
  label: string
  className?: string
}

const EMPTY_LINE = '0,13 10,11 20,12 30,9 40,11 50,10 60,11'

/** A tiny muted preview line: real data when Home already has it, a still line otherwise. */
export default function MiniSparkline({ values, label, className }: MiniSparklineProps) {
  // Render logic
  const width = 64
  const height = 20
  const max = Math.max(...values, 0)
  const points =
    max > 0
      ? values
          .map((v, i) => {
            const x = values.length > 1 ? (i / (values.length - 1)) * width : 0
            return `${x.toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`
          })
          .join(' ')
      : EMPTY_LINE

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="h-5 w-16 shrink-0 text-muted-foreground"
        aria-hidden="true"
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-caption whitespace-nowrap text-muted-foreground">{label}</span>
    </span>
  )
}
