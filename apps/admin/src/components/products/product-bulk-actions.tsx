'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import { AiIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { assistantContent } from '@/data/assistant'
import { productsListContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'

type ProductBulkActionsProps = {
  busy: boolean
  onStatus: (status: ProductStatus) => void
  onTag: () => void
  onDelete: () => void
  /** Bulk "Write with AI"; absent when AI is off or the role cannot write products. */
  onWriteAi?: (() => void) | undefined
}

/** Buttons inside the selection bar of the product list. */
export default function ProductBulkActions({
  busy,
  onStatus,
  onTag,
  onDelete,
  onWriteAi,
}: ProductBulkActionsProps) {
  // Hooks
  const { bulk: copy } = useCopy(productsListContent)
  const { bulk: ai } = useCopy(assistantContent)

  return (
    <>
      {onWriteAi ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={onWriteAi}>
          <AiIcon className="text-primary" aria-hidden="true" />
          {ai.button}
        </Button>
      ) : null}
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
