'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import { Button } from '@commerce/ui/shadcn/button'
import { productsListContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'

type ProductBulkActionsProps = {
  busy: boolean
  onStatus: (status: ProductStatus) => void
  onTag: () => void
  onDelete: () => void
}

/** Buttons inside the selection bar of the product list. */
export default function ProductBulkActions({
  busy,
  onStatus,
  onTag,
  onDelete,
}: ProductBulkActionsProps) {
  // Hooks
  const { bulk: copy } = useCopy(productsListContent)

  return (
    <>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onStatus('active')}>
        {copy.setActive}
      </Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onStatus('draft')}>
        {copy.setDraft}
      </Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onStatus('archived')}>
        {copy.archive}
      </Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={onTag}>
        {copy.addTag}
      </Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={onDelete}>
        {copy.delete}
      </Button>
    </>
  )
}
