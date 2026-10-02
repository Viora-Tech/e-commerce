import type { ImportStatus } from '@commerce/core/theme-import'
import { Badge } from '@commerce/ui/shadcn/badge'

type ImportStatusBadgeProps = {
  status: ImportStatus
  label: string
}

const VARIANT = {
  imported: 'success',
  replaced: 'info',
  unavailable: 'warning',
  unsupported: 'destructive',
} as const satisfies Record<ImportStatus, string>

/** The result pill of one imported section: exact, ours, not yet, or could not. */
export default function ImportStatusBadge({ status, label }: ImportStatusBadgeProps) {
  // Render logic
  return <Badge variant={VARIANT[status]}>{label}</Badge>
}
