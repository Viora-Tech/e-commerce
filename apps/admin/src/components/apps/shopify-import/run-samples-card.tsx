'use client'

import { IMPORT_RESOURCES, type PreviewSample } from '@commerce/plugin-shopify-import/client'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import PillTabs from '@/components/layout/pill-tabs'
import ScrollSection from '@/components/layout/scroll-section'
import { shopifyImportContent } from '@/data/shopify-import'
import { shopifyImportRunContent } from '@/data/shopify-import-run'
import { useCopy } from '@/hooks/use-copy'
import RunSampleRow from './run-sample-row'
import type { RunDetail } from './types'

type RunSamplesCardProps = {
  samples: PreviewSample[]
  /** The run's counters, to say how many more records of a type there are. */
  progress: RunDetail['progress']
}

/** The first few records of each type, one tab per type, with what the import would do to them. */
export default function RunSamplesCard({ samples, progress }: RunSamplesCardProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.run)
  const view = useCopy(shopifyImportRunContent)
  const resources = useCopy(shopifyImportContent.resources)
  const [picked, setPicked] = useState<string | null>(null)

  // Render logic
  const tabs = IMPORT_RESOURCES.map((resource) => ({
    resource,
    rows: samples.filter((s) => s.resource === resource),
  })).filter((t) => t.rows.length > 0)
  const current = tabs.find((t) => t.resource === picked) ?? tabs[0]
  const more = current ? (progress[current.resource]?.total ?? 0) - current.rows.length : 0

  return (
    <DataCard title={copy.sampleHeading}>
      <div className="flex flex-col gap-2">
        <PillTabs
          className="no-scrollbar max-w-full overflow-x-auto"
          value={current?.resource ?? null}
          onChange={(value) => setPicked(value)}
          tabs={tabs.map((t) => ({
            value: t.resource,
            label: resources[t.resource],
            count: t.rows.length,
          }))}
        />
        {current ? (
          <ScrollSection
            id={`shopify-import-samples-${current.resource}`}
            label={copy.sampleHeading}
            count={current.rows.length}
          >
            <ul className="flex flex-col divide-y divide-hairline rounded-xl border border-hairline">
              {current.rows.map((s) => (
                <RunSampleRow key={`${s.resource}-${s.key}`} sample={s} />
              ))}
            </ul>
          </ScrollSection>
        ) : (
          <EmptyState variant="inline" body={view.samples.empty} />
        )}
        {more > 0 ? (
          <p className="text-caption text-muted-foreground">{view.samples.more(more)}</p>
        ) : null}
      </div>
    </DataCard>
  )
}
