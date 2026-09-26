import { type ReturnTimes, returnTimeline } from '@commerce/core/returns'
import { formatAccountDate } from '@/data/account'
import { returnsContent } from '@/data/returns'

type ReturnTimelineProps = {
  row: ReturnTimes
  timeZone: string
}

/** A return's steps, done ones filled, the rest still ahead. */
export default function ReturnTimeline({ row, timeZone }: ReturnTimelineProps) {
  // Render logic
  const steps = returnTimeline(row)

  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s) => (
        <li key={s.key} className="flex items-start gap-3">
          <span
            aria-hidden
            className={`mt-1.5 size-2.5 shrink-0 rounded-full border ${
              s.done
                ? s.key === 'rejected' || s.key === 'cancelled'
                  ? 'border-danger bg-danger'
                  : 'border-success bg-success'
                : 'border-line bg-surface'
            }`}
          />
          <span className="flex flex-col">
            <span className={`text-small ${s.done ? 'text-ink' : 'text-muted'}`}>
              {returnsContent.steps[s.key]}
            </span>
            {s.done && s.at ? (
              <span className="text-small text-muted">{formatAccountDate(s.at, timeZone)}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  )
}
