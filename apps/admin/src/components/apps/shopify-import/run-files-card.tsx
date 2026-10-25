import DataCard from '@/components/layout/data-card'
import { formatBytes } from '@/components/media/file-meta'
import { shopifyImportFilesContent } from '@/data/shopify-import-files'
import { useCopy } from '@/hooks/use-copy'
import type { RunDetail } from './types'

type RunFilesCardProps = { run: RunDetail }

/** What the Files step copies and about how much space it takes once optimized. */
export default function RunFilesCard({ run }: RunFilesCardProps) {
  // Hooks
  const copy = useCopy(shopifyImportFilesContent)

  // Early returns
  const estimate = run.progress.files?.estimate
  if (!estimate) return null

  return (
    <DataCard title={copy.heading}>
      <div className="flex flex-col gap-2 text-body">
        <p className="font-medium text-ink-strong">
          {copy.line(
            estimate.images.count,
            estimate.videos.count,
            formatBytes(estimate.totalBytes),
          )}
        </p>
        {estimate.includeUnused ? (
          <p className="text-muted-foreground">{copy.unusedIncluded}</p>
        ) : estimate.unused.count > 0 ? (
          <p className="text-muted-foreground">
            {copy.unused(estimate.unused.count, formatBytes(estimate.unused.bytes))}
          </p>
        ) : null}
        <p className="text-caption text-muted-foreground">{copy.note}</p>
      </div>
    </DataCard>
  )
}
