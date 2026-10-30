'use client'

import { Bell, ChevronDown, Download, Pencil, Printer } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { toast } from 'sonner'
import type { OrderActionGroup } from '@/apps/order-actions'
import RunAutomationDialog from '@/components/automations/records/run-automation-dialog'
import { useRunAutomation } from '@/components/automations/records/use-run-automation'
import ActionMenu, { type ActionItem } from '@/components/layout/action-menu'
import CreateShipmentDialog from '@/components/shipments/create-shipment/create-shipment-dialog'
import { orderAppActionsContent } from '@/data/order-app-actions'
import { ORDER_MARKS, type OrderMark, ordersContent } from '@/data/orders'
import { ordersBulkContent } from '@/data/orders-bulk'
import { BULK_EDIT_IDS_KEY } from '@/data/orders-bulk-edit'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { downloadCsv } from '@/lib/csv'
import { ordersCsv } from '@/lib/orders-csv'
import { routes } from '@/lib/routes'
import type { OrdersBulkRequest } from './orders-bulk-dialogs'
import { useOrderAppActions } from './use-order-app-actions'

type OrdersBulkActionsProps = {
  ids: string[]
  onMark: (ids: string[], mark: OrderMark) => void
  /** Tags and payment reminders ask first: the page opens their dialog for these ids. */
  onRequest: (kind: OrdersBulkRequest['kind'], ids: string[]) => void
  /** Installed apps' order actions; those placed on the bulk bar show in its More actions. */
  appActions?: OrderActionGroup[]
  /** After an app action ran (or a bulk shipment was booked): clear the selection and reload. */
  onAppActionDone?: () => void
  /** The Automations app is installed: "Run automation" on the selection. */
  automations?: boolean
}

/** Most packing slips one print view loads (the ids ride in its URL). */
const PRINT_MAX = 100
/** Most ids one `orders.sheet` call takes. */
const SHEET_CHUNK = 5000

/**
 * Buttons for the selected orders: open them in the bulk-edit sheet, mark them all, and in
 * More actions add or remove tags, send payment reminders, export a CSV, print packing slips,
 * or run an installed app's action on them (a courier's Create shipment opens the bulk
 * shipment dialog with that courier picked).
 */
export default function OrdersBulkActions({
  ids,
  onMark,
  onRequest,
  appActions = [],
  onAppActionDone,
  automations = false,
}: OrdersBulkActionsProps) {
  // Hooks
  const copy = useCopy(ordersContent)
  const bulkCopy = useCopy(ordersBulkContent)
  const appCopy = useCopy(orderAppActionsContent)
  const router = useRouter()
  const apps = useOrderAppActions(appActions, () => onAppActionDone?.())
  const automation = useRunAutomation('order', automations)
  /* The dialog stays open on its Booked step; the list reloads once the merchant closes it. */
  const [booked, setBooked] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [exporting, setExporting] = useState(false)

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
  const handleExport = async () => {
    setExporting(true)
    try {
      const rows = []
      for (let i = 0; i < ids.length; i += SHEET_CHUNK) {
        rows.push(...(await api.orders.sheet({ ids: ids.slice(i, i + SHEET_CHUNK) })))
      }
      downloadCsv(
        `orders-${new Date().toISOString().slice(0, 10)}.csv`,
        ordersCsv(copy, bulkCopy, rows),
      )
      toast.success(bulkCopy.exportDone(rows.length))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : bulkCopy.exportFailed)
    } finally {
      setExporting(false)
    }
  }
  const handlePrint = () => {
    if (ids.length > PRINT_MAX) return void toast.error(bulkCopy.printTooMany(PRINT_MAX))
    window.open(routes.orders.packingSlips(ids), '_blank', 'noopener')
  }
  const handleShippingClosed = () => {
    apps.closeShipping()
    if (booked) onAppActionDone?.()
    setBooked(false)
  }

  // Render logic
  const appItems = apps.items('bulk', null, ids)
  const moreItems: ActionItem[] = [
    { label: bulkCopy.addTags, onSelect: () => onRequest('addTags', ids) },
    { label: bulkCopy.removeTags, onSelect: () => onRequest('removeTags', ids) },
    {
      label: bulkCopy.remind,
      icon: Bell,
      separatorBefore: true,
      onSelect: () => onRequest('remind', ids),
    },
    { label: bulkCopy.export, icon: Download, disabled: exporting, onSelect: handleExport },
    { label: bulkCopy.print, icon: Printer, onSelect: handlePrint },
    ...[...automation.items(ids), ...appItems].map((item, i) =>
      i === 0 ? { ...item, separatorBefore: true } : item,
    ),
  ]

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
            // Cancelling many orders asks first; one click used to do it (audit #48).
            <DropdownMenuItem
              key={s}
              variant={s === 'cancelled' ? 'destructive' : 'default'}
              onClick={() => (s === 'cancelled' ? setConfirmCancel(true) : onMark(ids, s))}
            >
              {copy.marks[s]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ActionMenu
        label={appCopy.bulkMenu}
        trigger="button"
        align="start"
        items={moreItems}
        disabled={apps.busy}
        triggerClassName="h-8 rounded-sm px-3"
      />
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={copy.bulk.cancelTitle(ids.length)}
        body={copy.bulk.cancelBody}
        confirmLabel={copy.bulk.cancelConfirm}
        cancelLabel={copy.bulk.keep}
        tone="destructive"
        onConfirm={() => {
          setConfirmCancel(false)
          onMark(ids, 'cancelled')
        }}
      />
      <CreateShipmentDialog
        orderIds={apps.shipping?.orderIds ?? []}
        courier={apps.shipping?.providerId}
        onClose={handleShippingClosed}
        onBooked={() => setBooked(true)}
      />
      <RunAutomationDialog
        subjectType="order"
        ids={automation.target}
        onClose={automation.close}
        onDone={onAppActionDone}
      />
    </>
  )
}
