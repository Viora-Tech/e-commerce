import type { MarketingRunStatus } from '@commerce/core/marketing'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import RelativeTime from '@/components/layout/relative-time'
import { automationEditorContent } from '@/data/marketing-automations'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'

type Run = NonNullable<Awaited<ReturnType<typeof api.marketing.automations.get>>>['runs'][number]

type AutomationRunsCardProps = { runs: Run[]; stepCount: number }

/** The latest shoppers in the automation and where each one is. */
export default function AutomationRunsCard({ runs, stepCount }: AutomationRunsCardProps) {
  // Hooks
  const copy = useCopy(automationEditorContent).runs

  // Derived
  function statusLine(r: Run, steps: number): string {
    const s = copy.status[r.status as MarketingRunStatus] ?? r.status
    if (r.status === 'active') return `${s} · ${copy.step(r.stepIndex, steps)}`
    if (r.status === 'stopped' && r.stopReason)
      return `${s} · ${copy.reasons[r.stopReason] ?? r.stopReason}`
    return s
  }

  // Render logic
  return (
    <DataCard title={copy.title}>
      {runs.length === 0 ? (
        <EmptyState variant="inline" body={copy.empty} />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {runs.map((r) => (
            <li key={r.id} className="flex flex-col gap-0.5 py-2">
              <span className="truncate text-body-strong">{r.name || r.email || r.phone}</span>
              <span className="text-caption text-muted-foreground">{statusLine(r, stepCount)}</span>
              <RelativeTime
                value={r.startedAt}
                className="text-caption text-muted-foreground-soft"
              />
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
