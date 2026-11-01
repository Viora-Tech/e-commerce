'use client'

import type { SearchPinGroup } from '@commerce/core'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import DataCard from '@/components/layout/data-card'
import { searchDiscoveryContent } from '@/data/search-discovery'
import { useCopy } from '@/hooks/use-copy'

type PinsCardProps = {
  groups: SearchPinGroup[]
  onAdd: () => void
  onEdit: (group: SearchPinGroup) => void
  onRemove: (group: SearchPinGroup) => void
  busy: boolean
}

/** The Boosts page's "Pinned products" card: each search with its pinned products, in order. */
export default function PinsCard({ groups, onAdd, onEdit, onRemove, busy }: PinsCardProps) {
  // Hooks
  const copy = useCopy(searchDiscoveryContent)

  // Render logic
  const c = copy.boosts.pins

  return (
    <DataCard
      title={c.title}
      subtitle={c.description}
      count={groups.length}
      action={
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus aria-hidden="true" />
          {c.add}
        </Button>
      }
      flush
    >
      {groups.length === 0 ? (
        <p className="px-5 py-6 text-body text-muted-foreground">{c.empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {groups.map((g) => (
            <li key={g.term} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-body-strong">{g.term}</span>
                <span className="truncate text-caption text-muted-foreground">
                  {c.products(g.products.length)} · {g.products.map((p) => p.title).join(', ')}
                </span>
              </div>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => onRemove(g)}>
                {c.remove}
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => onEdit(g)}>
                {c.edit}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
