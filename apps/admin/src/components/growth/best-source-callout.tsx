import type { SourceKey } from '@commerce/api'
import { TrendingUp } from '@commerce/ui/icons'
import { growthOverviewContent as copy, SOURCE_LABELS } from '@/data/growth'
import SourceIcon from './source-icon'

type BestSourceCalloutProps = { source: SourceKey }

/** "Your best source this period is Instagram": one line, no jargon. */
export default function BestSourceCallout({ source }: BestSourceCalloutProps) {
  // Render logic
  const title = copy.bestSource.title.replace('{source}', SOURCE_LABELS[source])

  return (
    <div className="flex items-start gap-3 rounded-[0.75rem] border border-border bg-card p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <TrendingUp className="size-4 text-primary" />
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="flex items-center gap-1.5 text-kit-body font-medium text-foreground">
          <SourceIcon source={source} className="size-4" />
          {title}
        </p>
        <p className="text-kit-mini text-muted-foreground">{copy.bestSource.body}</p>
      </div>
    </div>
  )
}
