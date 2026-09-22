'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { inventoryContent } from '@/data/inventory'

type InventoryBulkActionsProps = {
  busy: boolean
  onPick: (mode: 'adjust' | 'set') => void
}

const copy = inventoryContent.bulk

/** Buttons inside the selection bar of the inventory table. */
export default function InventoryBulkActions({ busy, onPick }: InventoryBulkActionsProps) {
  return (
    <>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onPick('adjust')}>
        {copy.adjust}
      </Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onPick('set')}>
        {copy.set}
      </Button>
    </>
  )
}
