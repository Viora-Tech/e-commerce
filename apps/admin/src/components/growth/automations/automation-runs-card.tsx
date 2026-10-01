import type { MarketingRunStatus } from '@commerce/core/marketing'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import RelativeTime from '@/components/layout/relative-time'
import { automationEditorContent } from '@/data/marketing-automations'
import type { api } from '@/lib/api-client'

type Run = NonNullable<Awaited<ReturnType<typeof api.marketing.automations.get>>>['runs'][number]

type AutomationRunsCardProps = { runs: Run[]; stepCount: number }

const copy = automationEditorContent.runs

function statusLine(r: Run, steps: number): string {
  const s = copy.status[r.status as MarketingRunStatus] ?? r.status
  if (r.status === 'active') return `${s} · ${copy.step(r.stepIndex, steps)}`
  if (r.status === 'stopped' && r.stopReason)
    return `${s} · ${copy.reasons[r.stopReason] ?? r.stopReason}`
  return s
}

/** The latest shoppers in the automation and where each one is. */
export default function AutomationRunsCard({ runs, stepCount }: AutomationRunsCardProps) {
  // Render logic
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-col gap-0.5 py-2">
                <span className="truncate text-body-strong">{r.name || r.email || r.phone}</span>
                <span className="text-caption text-muted-foreground">
                  {statusLine(r, stepCount)}
                </span>
                <RelativeTime
                  value={r.startedAt}
                  className="text-caption text-muted-foreground-soft"
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
