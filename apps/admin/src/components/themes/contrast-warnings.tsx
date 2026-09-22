import type { ContrastWarning } from '@commerce/core/theme'
import { TriangleAlert } from '@commerce/ui/icons'
import { themesContent as copy } from '@/data/themes'

type ContrastWarningsProps = { warnings: ContrastWarning[] }

/** Colour pairs below WCAG AA (4.5:1). Advisory: the merchant can still save. */
export default function ContrastWarnings({ warnings }: ContrastWarningsProps) {
  // Early returns
  if (warnings.length === 0) return null

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5"
    >
      <p className="flex items-center gap-1.5 text-body font-semibold text-foreground">
        <TriangleAlert className="size-4 shrink-0 text-warning-foreground" aria-hidden />
        {copy.contrast.heading}
      </p>
      <ul className="flex flex-col gap-1.5">
        {warnings.map((w) => (
          <li key={`${w.mode}:${w.pair}`} className="flex items-center gap-2">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-sm border border-border text-xs font-semibold"
              style={{ color: w.foreground, backgroundColor: w.background }}
              aria-hidden
            >
              {copy.contrast.swatch}
            </span>
            <span className="text-caption text-foreground">
              <span className="font-medium">{copy.contrast.pairs[w.pair]}</span>
              {'. '}
              {copy.contrast.ratio(w.mode, w.ratio)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
