'use client'

import { Bell, CancelCircle, Download, Pencil, Printer } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import type { OrderActionGroup } from '@/apps/order-actions'
import { saveFile } from '@/components/apps/gst-invoices/save-file'
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
import { routes } from '@/lib/routes'
import type { OrdersBulkRequest } from './orders-bulk-dialogs'
import { useOrderAppActions } from './use-order-app-actions'
import { useOrderInvoices } from './use-order-invoices'
import { useOrdersExport } from './use-orders-export'

type OrdersBulkActionsProps = {
  ids: string[]
  onMark: (ids: string[], mark: OrderMark) => void
  /** Archive (true) or unarchive (false) the selected orders. */
  onArchive: (ids: string[], archived: boolean) => void
  /** Tags, payment reminders and cancel ask first: the page opens their dialog for these ids. */
  onRequest: (kind: OrdersBulkRequest['kind'], ids: string[]) => void
  /** Installed apps' order actions; those placed on the bulk bar show in its More actions. */
  appActions?: OrderActionGroup[]
  /** After an app action ran (or a bulk shipment was booked): clear the selection and reload. */
  onAppActionDone?: () => void
  /** The Automations app is installed: "Run automation" on the selection. */
  automations?: boolean
}

/** The bar's Mark as: every move but cancel, which has its own dialog in More actions. */
const BULK_MARKS = ORDER_MARKS.filter(
  (m): m is Exclude<OrderMark, 'cancelled'> => m !== 'cancelled',
)

/** Most packing slips one print view loads (the ids ride in its URL). */
const PRINT_MAX = 100

/**
 * Buttons for the selected orders: open them in the bulk-edit sheet, mark them paid, fulfilled or
 * delivered, and in More actions add or remove tags, archive or unarchive them, send payment
 * reminders, export a CSV, print packing slips, cancel the ones with nothing to refund (#1408),
 * or run an installed app's action on them (a courier's Create shipment opens the bulk
 * shipment dialog with that courier picked).
 */
export default function OrdersBulkActions({
  ids,
  onMark,
  onArchive,
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
  const { exporting, exportOrders } = useOrdersExport()
  const invoiceIds = useOrderInvoices(ids)
  const [printing, setPrinting] = useState(false)

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
  const handleExport = () => exportOrders(ids)
  const handlePrint = (kind: 'packing_slip' | 'pick_list' | 'invoice') => {
    if (ids.length > PRINT_MAX) return void toast.error(bulkCopy.printTooMany(PRINT_MAX))
    window.open(routes.orders.printDocuments(kind, ids), '_blank', 'noopener')
  }
  /* With the GST invoices app: one PDF of the issued invoices, as its Invoices page prints. */
  const handlePrintIssued = async (docIds: string[]) => {
    setPrinting(true)
    try {
      saveFile(await api.gstInvoices.bulkPrint({ ids: docIds }), 'open')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : bulkCopy.printFailed)
    } finally {
      setPrinting(false)
    }
  }
  const handleShippingClosed = () => {
    apps.closeShipping()
    if (booked) onAppActionDone?.()
    setBooked(false)
  }

  // Render logic
  const appItems = apps.items('bulk', null, ids)
  const markItems: ActionItem[] = BULK_MARKS.map((m) => ({
    id: m,
    label: copy.marks[m],
    onSelect: () => onMark(ids, m),
  }))
  const moreItems: ActionItem[] = [
    { label: bulkCopy.addTags, onSelect: () => onRequest('addTags', ids) },
    { label: bulkCopy.removeTags, onSelect: () => onRequest('removeTags', ids) },
    { label: bulkCopy.archive, separatorBefore: true, onSelect: () => onArchive(ids, true) },
    { label: bulkCopy.unarchive, onSelect: () => onArchive(ids, false) },
    {
      label: bulkCopy.remind,
      icon: Bell,
      separatorBefore: true,
      onSelect: () => onRequest('remind', ids),
    },
    { label: bulkCopy.export, icon: Download, disabled: exporting, onSelect: handleExport },
    { label: bulkCopy.print, icon: Printer, onSelect: () => handlePrint('packing_slip') },
    { label: bulkCopy.printPickList, icon: Printer, onSelect: () => handlePrint('pick_list') },
    // Only orders with an issued invoice print one; with no GST app, the store's template.
    ...(invoiceIds === null
      ? [{ label: bulkCopy.printInvoices, icon: Printer, onSelect: () => handlePrint('invoice') }]
      : invoiceIds.length > 0
        ? [
            {
              label: bulkCopy.printIssuedInvoices(invoiceIds.length),
              icon: Printer,
              disabled: printing,
              onSelect: () => void handlePrintIssued(invoiceIds),
            },
          ]
        : []),
    ...[...automation.items(ids), ...appItems].map((item, i) =>
      i === 0 ? { ...item, separatorBefore: true } : item,
    ),
    // Unpaid orders only, on the order page's cancel path; paid ones are skipped and counted.
    {
      label: bulkCopy.cancel,
      icon: CancelCircle,
      destructive: true,
      onSelect: () => onRequest('cancel', ids),
    },
  ]

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleBulkEdit}>
        <Pencil />
        {copy.bulk.bulkEdit}
      </Button>
      {/* Cancel is not a mark here: More actions > Cancel orders asks about refunds (#1408). */}
      <ActionMenu
        label={copy.bulk.markAs}
        trigger="button"
        buttonSize="sm"
        align="start"
        items={markItems}
      />
      <ActionMenu
        label={appCopy.bulkMenu}
        trigger="button"
        buttonSize="sm"
        align="start"
        items={moreItems}
        disabled={apps.busy}
        // Wide enough that "Send payment reminders" fits on one line. Its height stays the
        // menu's own cap so a long list scrolls rather than running off the screen.
        contentClassName="min-w-64"
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
