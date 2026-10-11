'use client'

import type { RunStatus } from '@commerce/plugin-shopify-import/client'
import {
  CircleAlert,
  CircleCheck,
  Clock,
  Eye,
  type IconComponent,
  Loader2Icon,
  TriangleAlert,
} from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import IconBadge from '@/components/layout/icon-badge'
import { shopifyImportRunContent } from '@/data/shopify-import-run'
import { useCopy, useFormat } from '@/hooks/use-copy'
import RunActions from './run-actions'
import RunCurrentStep from './run-current-step'
import RunStopButton from './run-stop-button'
import type { RunDetail } from './types'

type RunHeaderCardProps = {
  run: RunDetail
  /** One plain sentence about where the run is (waiting, working, done, why it stopped). */
  message: string
  /** Extra notes: which preview it reuses, that it retries only the missed ones. */
  notes: string[]
  onQueued: () => void
  onStopped: () => void
}

type State = keyof (typeof shopifyImportRunContent)['state']
type Tone = 'success' | 'warning' | 'info' | 'danger' | 'neutral'

/** What the card says about a run: one state word, its glyph and tint. */
function stateOf(status: RunStatus, preview: boolean): State {
  if (status === 'queued') return 'waiting'
  if (status === 'running') return preview ? 'previewing' : 'importing'
  if (status === 'failed') return 'failed'
  if (status === 'cancelled') return 'stopped'
  return preview ? 'ready' : 'done'
}

const LOOK: Record<State, { icon: IconComponent; tone: Tone; spin?: boolean }> = {
  waiting: { icon: Clock, tone: 'neutral' },
  previewing: { icon: Loader2Icon, tone: 'info', spin: true },
  ready: { icon: Eye, tone: 'info' },
  importing: { icon: Loader2Icon, tone: 'info', spin: true },
  done: { icon: CircleCheck, tone: 'success' },
  failed: { icon: CircleAlert, tone: 'danger' },
  stopped: { icon: TriangleAlert, tone: 'warning' },
}

/**
 * The run's headline: its state with a glyph, when it started and finished, the
 * one sentence about what is going on, and the next step as buttons on the right.
 */
export default function RunHeaderCard({
  run,
  message,
  notes,
  onQueued,
  onStopped,
}: RunHeaderCardProps) {
  // Hooks
  const copy = useCopy(shopifyImportRunContent)
  const fmt = useFormat()

  // Render logic
  const state = stateOf(run.status, run.dryRun)
  const look = LOOK[state]
  const times = [
    run.startedAt ? copy.started(fmt.dateTime(run.startedAt)) : null,
    run.finishedAt ? copy.finished(fmt.dateTime(run.finishedAt)) : null,
  ].filter(Boolean)

  return (
    <section className="flex flex-col gap-4 rounded-2xl surface-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <IconBadge
            icon={look.icon}
            tone={look.tone}
            className={cn(look.spin && '[&_svg]:animate-spin motion-reduce:[&_svg]:animate-none')}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-card-title text-ink-strong">{copy.state[state]}</h2>
            {times.length ? (
              <p className="text-caption text-muted-foreground">{times.join(' · ')}</p>
            ) : null}
            <p className="max-w-prose text-body text-muted-foreground">{message}</p>
            {notes.map((note) => (
              <p key={note} className="max-w-prose text-caption text-muted-foreground">
                {note}
              </p>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          <RunStopButton run={run} onStopped={onStopped} />
          <RunActions run={run} onQueued={onQueued} />
        </div>
      </div>
      <RunCurrentStep run={run} />
    </section>
  )
}
