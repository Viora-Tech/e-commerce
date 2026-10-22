'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import {
  AiIcon,
  Archive,
  CircleCheck,
  Download,
  FileEdit,
  Folder,
  Pencil,
  Tag,
  Trash2,
} from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import { assistantContent } from '@/data/assistant'
import { bulkActionsContent } from '@/data/bulk-actions'
import { productsListContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { runBatched, toastOutcome } from '@/lib/run-batched'
import AddToCollectionDialog from './add-to-collection-dialog'
import { downloadProductCsv } from './export-products'

type ExportRows = Awaited<ReturnType<typeof api.products.exportRows>>

type ProductBulkActionsProps = {
  /** The selected products. */
  ids: string[]
  busy: boolean
  onStatus: (status: ProductStatus) => void
  onTag: () => void
  onBulkEdit: () => void
  onDelete: () => void
  /** Bulk "Write with AI"; absent when AI is off or the role cannot write products. */
  onWriteAi?: (() => void) | undefined
  /** After products joined a collection: clear the selection and reload. */
  onDone: () => void
}

/** Adds one product to a manual collection, keeping the other collections it sits in. */
async function withCollection(productId: string, collectionId: string) {
  const current = await api.collections.forProduct({ productId })
  if (current.includes(collectionId)) return
  await api.collections.setForProduct({ productId, collectionIds: [...current, collectionId] })
}

/** Buttons inside the selection bar of the product list. */
export default function ProductBulkActions({
  ids,
  busy,
  onStatus,
  onTag,
  onBulkEdit,
  onDelete,
  onWriteAi,
  onDone,
}: ProductBulkActionsProps) {
  // Hooks
  const { bulk: copy, exporting } = useCopy(productsListContent)
  const { bulk: ai } = useCopy(assistantContent)
  const shared = useCopy(bulkActionsContent)
  const [working, setWorking] = useState(false)
  const [picking, setPicking] = useState(false)

  // Event handlers
  /* exportRows takes at most 100 ids, so a bigger selection goes over in slices. */
  const handleExport = async () => {
    setWorking(true)
    try {
      const rows: ExportRows = []
      for (let i = 0; i < ids.length; i += 100) {
        rows.push(...(await api.products.exportRows({ ids: ids.slice(i, i + 100) })))
      }
      if (rows.length === 0) toast.error(exporting.empty)
      else downloadProductCsv(rows)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : exporting.failed)
    } finally {
      setWorking(false)
    }
  }

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
      {onWriteAi ? (
        <Button variant="outline" size="sm" disabled={disabled} onClick={onWriteAi}>
          <AiIcon className="text-primary" aria-hidden="true" />
          {ai.button}
        </Button>
      ) : null}
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
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onStatus('archived')}>
        <Archive aria-hidden="true" />
        {copy.archive}
      </Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={onTag}>
        <Tag aria-hidden="true" />
        {copy.addTag}
      </Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => setPicking(true)}>
        <Folder aria-hidden="true" />
        {copy.addToCollection}
      </Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={handleExport}>
        <Download aria-hidden="true" />
        {copy.exportSelected}
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
