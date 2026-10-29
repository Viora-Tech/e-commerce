'use client'

import type { BugReportStatus } from '@commerce/core/bug-reports'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import { myBugReportsContent } from '@/data/bug-report'
import { useCopy } from '@/hooks/use-copy'

type BugReportStatusChipProps = {
  status: BugReportStatus
}

/** Waiting is quiet, being fixed is in progress, fixed is on its way, live is done. */
const TONE: Record<BugReportStatus, ChipTone> = {
  received: 'neutral',
  in_progress: 'info',
  fixed: 'violet',
  live: 'success',
  wont_fix: 'neutral',
}

/** A bug report's status: Received, Being fixed, Fixed – in the next update, Live, Won't fix. */
export default function BugReportStatusChip({ status }: BugReportStatusChipProps) {
  // Hooks
  const copy = useCopy(myBugReportsContent)

  return <StatusChip tone={TONE[status]}>{copy.status[status]}</StatusChip>
}
