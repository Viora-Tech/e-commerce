import type { DataRequestStatus } from '@commerce/core/privacy'
import StatusChip from '@/components/layout/status-chip'
import { STATUS_LABEL } from '@/data/customer-privacy'

type DataRequestStatusBadgeProps = { status: DataRequestStatus }

const VARIANT = {
  open: 'info',
  in_progress: 'attention',
  completed: 'success',
  rejected: 'neutral',
} as const

/** A data request's status as a pill. */
export default function DataRequestStatusBadge({ status }: DataRequestStatusBadgeProps) {
  // Render logic
  return <StatusChip tone={VARIANT[status]}>{STATUS_LABEL[status]}</StatusChip>
}
