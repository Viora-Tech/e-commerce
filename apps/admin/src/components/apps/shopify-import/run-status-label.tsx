import type { RunStatus } from '@commerce/plugin-shopify-import/client'
import StatusLabel from '@/components/status/status-label'

type RunStatusLabelProps = { status: RunStatus; preview: boolean }

/** A finished dry run reads "Preview ready"; everything else is the run's own status. */
export default function RunStatusLabel({ status, preview }: RunStatusLabelProps) {
  // Render logic
  const value = status === 'completed' && preview ? 'preview' : status

  return <StatusLabel kind="importRun" value={value} />
}
