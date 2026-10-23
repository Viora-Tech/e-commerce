'use client'

import type { StepRunView } from '@commerce/core/automations'
import { ShieldCheck } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import { automationRunContent, automationRunStatusContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import { automationRoutes } from '@/lib/automation-routes'

type RunStepItemProps = {
  step: StepRunView
  title: string
  selected: boolean
  onSelect: () => void
}

const TONE: Record<StepRunView['status'], ChipTone> = {
  running: 'info',
  succeeded: 'success',
  // biome-ignore lint/suspicious/noThenProperty: a run status the engine calls "then"
  then: 'success',
  otherwise: 'neutral',
  failed: 'danger',
  skipped: 'neutral',
  waiting: 'attention',
  awaiting_approval: 'attention',
  cancelled: 'neutral',
}

function DataBlock({ label, data }: { label: string; data: Record<string, unknown> }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-eyebrow text-muted-foreground">{label}</span>
      <pre className="max-h-48 overflow-auto rounded-md bg-muted px-3 py-2 font-mono text-xs whitespace-pre-wrap break-all">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

/** One step of a run's timeline: status, attempt, when, then its input, result, error or approval wait. */
export default function RunStepItem({ step, title, selected, onSelect }: RunStepItemProps) {
  // Hooks
  const copy = useCopy(automationRunContent)
  const statuses = useCopy(automationRunStatusContent)

  // Render logic
  const hidden =
    step.kind === 'action' &&
    step.input === null &&
    step.output === null &&
    step.status !== 'running'

  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-border p-3',
        selected && 'shadow-[inset_0_0_0_1.5px_var(--primary)]',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex flex-wrap items-center justify-between gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-body-strong text-ink-strong">{title}</span>
        <span className="flex items-center gap-2 text-caption text-muted-foreground">
          {step.attempt > 1 ? <span>{copy.attempt(step.attempt)}</span> : null}
          <RelativeTime value={step.startedAt} />
          <StatusChip tone={TONE[step.status]}>{statuses.step[step.status]}</StatusChip>
        </span>
      </button>
      {step.summary ? <p className="text-body text-muted-foreground">{step.summary}</p> : null}
      {step.status === 'awaiting_approval' ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-body text-warning-foreground dark:text-warning">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-4" aria-hidden="true" />
            {copy.waitingApproval}
            {step.approval?.expiresAt ? (
              <>
                {' · '}
                {copy.expires} <RelativeTime value={step.approval.expiresAt} />
              </>
            ) : null}
          </span>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={automationRoutes.approvals()} />}
          >
            {copy.openApprovals}
          </Button>
        </div>
      ) : null}
      {step.approval?.decidedBy ? (
        <p className="text-caption text-muted-foreground">
          {copy.decidedBy(step.approval.decidedBy)}
        </p>
      ) : null}
      {step.error ? (
        <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-body text-danger">
          <span className="font-medium">{copy.error}: </span>
          {step.error}
        </p>
      ) : null}
      {hidden ? <p className="text-caption text-muted-foreground">{copy.hidden}</p> : null}
      {selected && step.input ? <DataBlock label={copy.input} data={step.input} /> : null}
      {selected && step.output ? <DataBlock label={copy.output} data={step.output} /> : null}
    </li>
  )
}
