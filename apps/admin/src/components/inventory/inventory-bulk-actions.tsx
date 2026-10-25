'use client'

import { ArrowUpDown, Pencil } from '@commerce/ui/icons'
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
        <ArrowUpDown aria-hidden="true" />
        {copy.adjust}
      </Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onPick('set')}>
        <Pencil aria-hidden="true" />
        {copy.set}
      </Button>
    </>
  )
}
