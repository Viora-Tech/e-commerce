import { IMPORT_RESOURCES, type ResourceProgress } from '@commerce/plugin-shopify-import/client'
import DataCard from '@/components/layout/data-card'
import { shopifyImportContent } from '@/data/shopify-import'
import { shopifyImportRunContent } from '@/data/shopify-import-run'
import { useCopy } from '@/hooks/use-copy'
import RunTypeCard from './run-type-card'
import type { RunDetail } from './types'

type RunTypeGridProps = { run: RunDetail }

const EMPTY: ResourceProgress = {
  total: 0,
  processed: 0,
  created: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
}

/** Everything the run covers as a grid of type cards; types with nothing to bring fold into one line. */
export default function RunTypeGrid({ run }: RunTypeGridProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.run)
  const view = useCopy(shopifyImportRunContent)
  const resources = useCopy(shopifyImportContent.resources)

  // Render logic
  const rows = IMPORT_RESOURCES.filter((r) => run.resources.includes(r)).map((resource) => ({
    resource,
    progress: run.progress[resource] ?? EMPTY,
  }))
  const shown = rows.filter((r) => r.progress.total > 0)
  const empty = rows.filter((r) => r.progress.total === 0)
  if (shown.length === 0) return null
  const live = run.status === 'queued' || run.status === 'running'

  return (
    <DataCard title={copy.progressHeading}>
      <div className="flex flex-col gap-4">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map(({ resource, progress }) => (
            <RunTypeCard
              key={resource}
              resource={resource}
              progress={progress}
              live={live}
              preview={run.dryRun}
            />
          ))}
        </ul>
        {empty.length ? (
          <p className="text-caption text-muted-foreground">
            {view.types.nothing(empty.map((r) => resources[r.resource]).join(', '))}
          </p>
        ) : null}
      </div>
    </DataCard>
  )
}
