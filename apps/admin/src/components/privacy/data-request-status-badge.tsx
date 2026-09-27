import type { DataRequestStatus } from '@commerce/core/privacy'
import { Badge } from '@commerce/ui/shadcn/badge'
import { STATUS_LABEL } from '@/data/customer-privacy'

type DataRequestStatusBadgeProps = { status: DataRequestStatus }

const VARIANT = {
  open: 'info',
  in_progress: 'warning',
  completed: 'success',
  rejected: 'neutral',
} as const

/** A data request's status as a pill. */
export default function DataRequestStatusBadge({ status }: DataRequestStatusBadgeProps) {
  // Render logic
  return <Badge variant={VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
}
