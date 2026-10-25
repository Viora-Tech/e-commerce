'use client'

import type { ParsedQuery } from '@commerce/core/analytics-query'
import { useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import QueryControls from './query-controls'
import QuerySchemaPanel from './query-schema-panel'

type QuerySidePanelProps = {
  query: ParsedQuery
  /** False while the text does not parse. */
  enabled: boolean
  onChange: (next: ParsedQuery) => void
  onInsert: (name: string) => void
}

type Tab = 'controls' | 'reference'

/** The editor's right panel: the query as controls, or the reference of every table and field. */
export default function QuerySidePanel({
  query,
  enabled,
  onChange,
  onInsert,
}: QuerySidePanelProps) {
  // Hooks
  const copy = useCopy(analyticsContent.query.controls)
  const [tab, setTab] = useState<Tab>('controls')

  // Render logic
  return (
    <aside className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      <PillTabs<Tab>
        variant="segmented"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'controls', label: copy.tab },
          { value: 'reference', label: copy.reference },
        ]}
      />
      {tab === 'controls' ? (
        <QueryControls query={query} enabled={enabled} onChange={onChange} />
      ) : (
        <QuerySchemaPanel table={query.table} onInsert={onInsert} />
      )}
    </aside>
  )
}
