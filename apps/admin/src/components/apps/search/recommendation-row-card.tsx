'use client'

import { MAX_PICKED_RECOMMENDATIONS } from '@commerce/core/discovery'
import { Plus, Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import SelectProductsDialog, {
  type PickedProducts,
} from '@/components/products/select-products-dialog'
import { searchDiscoveryContent } from '@/data/search-discovery'
import { useCopy } from '@/hooks/use-copy'
import PickedList, { type PickedItem } from './picked-list'

type RecommendationRowCardProps = {
  title: string
  description: string
  /** The product being edited: never offered as its own pick. */
  productId: string
  picks: PickedItem[]
  onSave: (ids: string[]) => Promise<void>
}

const ids = (items: PickedItem[]) => items.map((i) => i.id).join(',')

/** One recommendation row's picks for a product: ordered, with add, move, remove and save. */
export default function RecommendationRowCard({
  title,
  description,
  productId,
  picks,
  onSave,
}: RecommendationRowCardProps) {
  // Hooks
  const copy = useCopy(searchDiscoveryContent)
  const [draft, setDraft] = useState<PickedItem[]>(picks)
  const [choosing, setChoosing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(picks)
  }, [picks])

  // Event handlers
  const handleChosen = (picked: PickedProducts) => {
    const added = picked
      .map((p) => ({ id: p.product.id, title: p.product.title, status: p.product.status }))
      .filter((p) => p.id !== productId && !draft.some((x) => x.id === p.id))
    setDraft([...draft, ...added].slice(0, MAX_PICKED_RECOMMENDATIONS))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(draft.map((d) => d.id))
    } finally {
      setSaving(false)
    }
  }

  const statusLabel = (status: string) =>
    status === 'draft' ? copy.editor.draft : status === 'archived' ? copy.editor.archived : null

  // Render logic
  const e = copy.editor
  const dirty = ids(draft) !== ids(picks)

  return (
    <DataCard
      title={title}
      subtitle={description}
      count={draft.length}
      action={
        <Button
          variant="outline"
          size="sm"
          disabled={draft.length >= MAX_PICKED_RECOMMENDATIONS}
          onClick={() => setChoosing(true)}
        >
          <Plus aria-hidden="true" />
          {e.add}
        </Button>
      }
      footer={
        <Button variant="outline" loading={saving} disabled={saving || !dirty} onClick={handleSave}>
          <Save aria-hidden="true" />
          {e.save}
        </Button>
      }
    >
      <PickedList
        items={draft}
        onChange={setDraft}
        empty={e.empty}
        labels={{ moveUp: e.moveUp, moveDown: e.moveDown, remove: e.remove }}
        statusLabel={statusLabel}
      />
      <p className="mt-2 text-caption text-muted-foreground">
        {e.limit(MAX_PICKED_RECOMMENDATIONS)}
      </p>
      <SelectProductsDialog
        open={choosing}
        onOpenChange={setChoosing}
        addedProductIds={[productId, ...draft.map((d) => d.id)]}
        onConfirm={handleChosen}
      />
    </DataCard>
  )
}
