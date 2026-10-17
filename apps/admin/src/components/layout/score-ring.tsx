import { cn } from '@commerce/ui/lib/utils'
import { scoreBand } from '@/lib/score'

const RING_TONE = { good: 'text-success', fair: 'text-warning', poor: 'text-danger' } as const
const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

type ScoreRingProps = {
  score: number
  /** "out of 100", under the figure. */
  caption: string
  className?: string
}

/** A 0–100 score on a ring, coloured by its band (SEO score, AI-ready score). */
export default function ScoreRing({ score, caption, className }: ScoreRingProps) {
  // Render logic
  const filled = (Math.max(0, Math.min(100, score)) / 100) * CIRCUMFERENCE
  return (
    <div className={cn('relative size-32 shrink-0', className)}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="10" className="stroke-muted" />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
          className={RING_TONE[scoreBand(score)]}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[2.25rem] leading-none font-semibold text-ink-strong tabular-nums">
          {score}
        </span>
        <span className="text-caption text-muted-foreground">{caption}</span>
      </span>
    </div>
  )
}
