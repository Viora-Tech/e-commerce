import type { ReactNode } from 'react'
import StatusChip from '@/components/layout/status-chip'

export type IssueSeverity = 'high' | 'medium' | 'low'

const TONE = { high: 'danger', medium: 'attention', low: 'neutral' } as const

type IssueRowProps = {
  severity: IssueSeverity
  severityLabel: string
  title: string
  /** "Product", "Policy". */
  kind: string
  detail: string
  action?: ReactNode
}

/** Figma "Issue row": impact, what it is, why agents or Meta care, and the one fix. */
export default function IssueRow({
  severity,
  severityLabel,
  title,
  kind,
  detail,
  action,
}: IssueRowProps) {
  // Render logic
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <StatusChip tone={TONE[severity]} variant="dot" className="w-20 shrink-0">
        {severityLabel}
      </StatusChip>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-body font-medium text-ink-strong">{title}</span>
          <span className="shrink-0 text-caption text-muted-foreground">{kind}</span>
        </p>
        <p className="text-caption text-muted-foreground">{detail}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </li>
  )
}
