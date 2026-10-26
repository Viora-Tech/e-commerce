'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import { CircleCheck, FileEdit, Folder, Pencil, Tag, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { bulkActionsContent } from '@/data/bulk-actions'
import { productsListContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { runBatched, toastOutcome } from '@/lib/run-batched'
import AddToCollectionDialog from './add-to-collection-dialog'

type ProductBulkActionsProps = {
  /** The selected products. */
  ids: string[]
  busy: boolean
  onStatus: (status: ProductStatus) => void
  onTag: () => void
  onBulkEdit: () => void
  onDelete: () => void
  /** After products joined a collection: clear the selection and reload. */
  onDone: () => void
}

/** Adds one product to a manual collection, keeping the other collections it sits in. */
async function withCollection(productId: string, collectionId: string) {
  const current = await api.collections.forProduct({ productId })
  if (current.includes(collectionId)) return
  await api.collections.setForProduct({ productId, collectionIds: [...current, collectionId] })
}

/**
 * The main bulk actions of the product list, in the floating bar. The less common ones (Write
 * with AI, Archive, Export, Run automation) are in the header's ⋯ menu (`ProductBulkMore`).
 */
export default function ProductBulkActions({
  ids,
  busy,
  onStatus,
  onTag,
  onBulkEdit,
  onDelete,
  onDone,
}: ProductBulkActionsProps) {
  // Hooks
  const { bulk: copy } = useCopy(productsListContent)
  const shared = useCopy(bulkActionsContent)
  const [working, setWorking] = useState(false)
  const [picking, setPicking] = useState(false)

  // Event handlers
  const handleAddToCollection = async (collectionId: string) => {
    setWorking(true)
    const outcome = await runBatched(ids, (id) => withCollection(id, collectionId))
    setWorking(false)
    setPicking(false)
    toastOutcome(outcome, shared.summary)
    onDone()
  }

  // Render logic
  const disabled = busy || working

  return (
    <>
      <Button variant="outline" size="sm" disabled={disabled} onClick={onBulkEdit}>
        <Pencil aria-hidden="true" />
        {copy.bulkEdit}
      </Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onStatus('active')}>
        <CircleCheck aria-hidden="true" />
        {copy.setActive}
      </Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onStatus('draft')}>
        <FileEdit aria-hidden="true" />
        {copy.setDraft}
      </Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={onTag}>
        <Tag aria-hidden="true" />
        {copy.addTag}
      </Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => setPicking(true)}>
        <Folder aria-hidden="true" />
        {copy.addToCollection}
      </Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={onDelete}>
        <Trash2 aria-hidden="true" />
        {copy.delete}
      </Button>
      <AddToCollectionDialog
        count={picking ? ids.length : 0}
        busy={working}
        onClose={() => setPicking(false)}
        onApply={handleAddToCollection}
      />
    </>
  )
}
