'use client'

import { Badge } from '@commerce/ui/shadcn/badge'
import { useEffect, useState } from 'react'
import SettingsCard from '@/components/settings/settings-card'
import { growthbookContent } from '@/data/growthbook'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type ExperimentListProps = {
  /** Changes whenever the settings are saved, so the list reloads. */
  version: number
  /** "Open in GrowthBook" target, when known. */
  openUrl: string | null
}

type View = Awaited<ReturnType<typeof api.growthbook.experiments>>

type Experiment = Extract<View, { state: 'ready' }>['experiments'][number]

const STATUS_VARIANT: Record<Experiment['status'], 'success' | 'neutral' | 'info'> = {
  running: 'success',
  draft: 'neutral',
  stopped: 'info',
}

/**
 * The experiments GrowthBook has, running first: name, status (and verdict once stopped), the
 * tracking key a section's "A/B test" setting takes, its variants by number, and when it started.
 */
export default function ExperimentList({ version, openUrl }: ExperimentListProps) {
  // Hooks
  const copy = useCopy(growthbookContent)
  const format = useFormat()
  const [view, setView] = useState<View | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload after every save of the settings
  useEffect(() => {
    setView(null)
    api.growthbook
      .experiments()
      .then(setView)
      .catch((err: unknown) =>
        setView({ state: 'error', message: err instanceof Error ? err.message : '' }),
      )
  }, [version])

  // Helpers
  const resultLabel = (result: string | null) =>
    result && Object.hasOwn(copy.experiments.result, result)
      ? copy.experiments.result[result as keyof typeof copy.experiments.result]
      : null

  // Render logic
  const message = !view
    ? copy.experiments.loading
    : view.state === 'not-connected'
      ? copy.experiments.notConnected
      : view.state === 'no-key'
        ? copy.experiments.noKey
        : view.state === 'error'
          ? `${copy.experiments.error}${view.message ? `: ${view.message}` : ''}`
          : view.experiments.length === 0
            ? copy.experiments.empty
            : null
  const experiments = view?.state === 'ready' ? view.experiments : []

  return (
    <SettingsCard title={copy.experiments.title} description={copy.experiments.description}>
      {message ? <p className="text-body text-muted-foreground">{message}</p> : null}
      {experiments.length ? (
        <ul className="flex flex-col divide-y divide-border">
          {experiments.map((e) => (
            <li key={e.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{e.name}</span>
                <Badge variant={STATUS_VARIANT[e.status]}>
                  {copy.experiments.status[e.status]}
                </Badge>
                {resultLabel(e.result) ? (
                  <Badge variant="outline">{resultLabel(e.result)}</Badge>
                ) : null}
              </div>
              <p className="text-caption text-muted-foreground">
                {copy.experiments.trackingKey}:{' '}
                <code className="font-mono text-foreground">{e.trackingKey}</code>
                {e.startedAt ? ` · ${copy.experiments.started(format.date(e.startedAt))}` : null}
              </p>
              {e.variations.length ? (
                <p className="text-caption text-muted-foreground">
                  {copy.experiments.variations}:{' '}
                  {e.variations.map((v) => `${v.id} ${v.name || v.key}`).join(' · ')}
                </p>
              ) : null}
              {openUrl ? (
                <a
                  href={`${openUrl}/experiment/${encodeURIComponent(e.id)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-caption font-medium text-primary underline-offset-4 hover:underline"
                >
                  {copy.experiments.open}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </SettingsCard>
  )
}
