'use client'

import { ChevronDown, Pencil } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ORDER_MARKS, type OrderMark, ordersContent } from '@/data/orders'
import { BULK_EDIT_IDS_KEY } from '@/data/orders-bulk-edit'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type OrdersBulkActionsProps = {
  ids: string[]
  onMark: (ids: string[], mark: OrderMark) => void
}

/** Buttons for the selected orders: open them in the bulk-edit sheet, or mark them all. */
export default function OrdersBulkActions({ ids, onMark }: OrdersBulkActionsProps) {
  // Hooks
  const copy = useCopy(ordersContent)
  const router = useRouter()

  // Event handlers
  /* Thousands of ids don't fit in a URL: hand them to the sheet through sessionStorage. */
  const handleBulkEdit = () => {
    try {
      sessionStorage.setItem(BULK_EDIT_IDS_KEY, JSON.stringify(ids))
    } catch {
      toast.error(copy.bulk.failed)
      return
    }
    router.push(routes.orders.bulkEdit())
  }

  // Render logic
  return (
    <>
      <Button variant="outline" size="sm" onClick={handleBulkEdit}>
        <Pencil />
        {copy.bulk.bulkEdit}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          {copy.bulk.markAs}
          <ChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {ORDER_MARKS.map((s) => (
            <DropdownMenuItem key={s} onClick={() => onMark(ids, s)}>
              {copy.marks[s]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
