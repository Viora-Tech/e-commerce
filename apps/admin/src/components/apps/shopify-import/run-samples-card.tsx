'use client'

import { IMPORT_RESOURCES, type PreviewSample } from '@commerce/plugin-shopify-import/client'
import { Tabs, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
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
      <Tabs value={current?.resource ?? ''} onValueChange={(value) => setPicked(String(value))}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList variant="line" className="h-auto w-max gap-1">
            {tabs.map((t) => (
              <TabsTrigger key={t.resource} value={t.resource} className="h-9 flex-none px-3">
                {resources[t.resource]}
                <span className="text-caption text-muted-foreground tabular-nums">
                  {t.rows.length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {current ? (
          <ul className="flex flex-col divide-y divide-hairline rounded-xl border border-hairline">
            {current.rows.map((s) => (
              <RunSampleRow key={`${s.resource}-${s.key}`} sample={s} />
            ))}
          </ul>
        ) : (
          <p className="text-body text-muted-foreground">{view.samples.empty}</p>
        )}
        {more > 0 ? (
          <p className="text-caption text-muted-foreground">{view.samples.more(more)}</p>
        ) : null}
      </Tabs>
    </DataCard>
  )
}
