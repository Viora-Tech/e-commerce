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
import { useState } from 'react'
import { toast } from 'sonner'
import type { OrderActionGroup } from '@/apps/order-actions'
import ActionMenu from '@/components/layout/action-menu'
import CreateShipmentDialog from '@/components/shipments/create-shipment/create-shipment-dialog'
import { orderAppActionsContent } from '@/data/order-app-actions'
import { ORDER_MARKS, type OrderMark, ordersContent } from '@/data/orders'
import { BULK_EDIT_IDS_KEY } from '@/data/orders-bulk-edit'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import { useOrderAppActions } from './use-order-app-actions'

type OrdersBulkActionsProps = {
  ids: string[]
  onMark: (ids: string[], mark: OrderMark) => void
  /** Installed apps' order actions; those placed on the bulk bar show in its More actions. */
  appActions?: OrderActionGroup[]
  /** After an app action ran (or a bulk shipment was booked): clear the selection and reload. */
  onAppActionDone?: () => void
}

/**
 * Buttons for the selected orders: open them in the bulk-edit sheet, mark them all, or run an
 * installed app's action on them (a courier's Create shipment opens the bulk shipment dialog
 * with that courier picked).
 */
export default function OrdersBulkActions({
  ids,
  onMark,
  appActions = [],
  onAppActionDone,
}: OrdersBulkActionsProps) {
  // Hooks
  const copy = useCopy(ordersContent)
  const appCopy = useCopy(orderAppActionsContent)
  const router = useRouter()
  const apps = useOrderAppActions(appActions, () => onAppActionDone?.())
  /* The dialog stays open on its Booked step; the list reloads once the merchant closes it. */
  const [booked, setBooked] = useState(false)

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
  const handleShippingClosed = () => {
    apps.closeShipping()
    if (booked) onAppActionDone?.()
    setBooked(false)
  }

  // Render logic
  const appItems = apps.items('bulk', null, ids)

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
      <ActionMenu
        label={appCopy.bulkMenu}
        trigger="button"
        align="start"
        items={appItems}
        disabled={apps.busy}
        triggerClassName="h-8 rounded-sm px-3"
      />
      <CreateShipmentDialog
        orderIds={apps.shipping?.orderIds ?? []}
        courier={apps.shipping?.providerId}
        onClose={handleShippingClosed}
        onBooked={() => setBooked(true)}
      />
    </>
  )
}
