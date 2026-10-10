'use client'

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontal,
  Printer,
  RotateCcw,
  Send,
} from '@commerce/ui/icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@commerce/ui/shadcn/alert-dialog'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import Link from 'next/link'
import { useState } from 'react'
import {
  type OrderFulfillmentStatus,
  type OrderMark,
  type OrderPaymentStatus,
  type OrderStatus,
  orderDetailContent,
} from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'

type OrderActionsProps = {
  status: OrderStatus
  paymentStatus: OrderPaymentStatus
  fulfillmentStatus: OrderFulfillmentStatus
  canRefund: boolean
  busy: boolean
  onMove: (to: OrderMark) => void
  onRefund: () => void
  /** Present while a deposit pre-order's balance is owed: "Request balance". */
  onRequestBalance?: (() => void) | undefined
  /** Imported history: only printing and stepping between orders. */
  readOnly?: boolean
  previousId?: string | undefined
  nextId?: string | undefined
}

type Step = { label: string; to: OrderMark }

const OWED: ReadonlySet<OrderPaymentStatus> = new Set(['unpaid', 'authorized', 'partially_paid'])
const TO_PACK: ReadonlySet<OrderFulfillmentStatus> = new Set(['unfulfilled', 'partially_fulfilled'])
const ON_ITS_WAY: ReadonlySet<OrderFulfillmentStatus> = new Set([
  'fulfilled',
  'shipped',
  'partially_delivered',
])

/**
 * The one forward step for an open order: take the money, then pack, then
 * hand over. Taking the money and marking delivered earn the ink button;
 * packing stays in the menu because the Unfulfilled section already offers it.
 */
function nextStep(
  copy: typeof orderDetailContent,
  status: OrderStatus,
  payment: OrderPaymentStatus,
  fulfilment: OrderFulfillmentStatus,
): Step | undefined {
  if (status !== 'open') return undefined
  if (OWED.has(payment)) return { label: copy.actions.markPaid, to: 'paid' }
  if (TO_PACK.has(fulfilment)) {
    return { label: copy.actions.fulfil, to: 'fulfilled' }
  }
  if (ON_ITS_WAY.has(fulfilment)) {
    return { label: copy.actions.deliver, to: 'delivered' }
  }
  return undefined
}

export default function OrderActions({
  status,
  paymentStatus,
  fulfillmentStatus,
  canRefund,
  busy,
  onMove,
  onRefund,
  onRequestBalance,
  readOnly = false,
  previousId,
  nextId,
}: OrderActionsProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const [confirmCancel, setConfirmCancel] = useState(false)

  // Render logic
  const next = readOnly ? undefined : nextStep(copy, status, paymentStatus, fulfillmentStatus)
  /* The Next step card owns the main action; the menu keeps the same move for when it is not shown. */
  const menuMove = next
  // Once the parcel is in the shopper's hands, a cancel no longer undoes anything.
  const cancellable = !readOnly && status === 'open' && fulfillmentStatus !== 'delivered'
  const refundable = !readOnly && canRefund

  /* After the Saleor Dashboard order header (BSD-3): small square icon buttons, one menu for
     everything secondary; the main action lives in the Next step card. */
  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button variant="key-neutral" title={copy.actions.print} onClick={() => window.print()}>
        <Printer aria-hidden="true" />
        {copy.actions.printShort}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="key-neutral" size="icon" aria-label={copy.actions.more} />}
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {menuMove ? (
            <DropdownMenuItem onClick={() => onMove(menuMove.to)} disabled={busy}>
              {menuMove.label}
            </DropdownMenuItem>
          ) : null}
          {refundable ? (
            <DropdownMenuItem onClick={onRefund} disabled={busy}>
              <RotateCcw aria-hidden="true" /> {copy.actions.refund}
            </DropdownMenuItem>
          ) : null}
          {onRequestBalance && !readOnly ? (
            <DropdownMenuItem onClick={onRequestBalance} disabled={busy}>
              <Send aria-hidden="true" /> {copy.payment.preorder.request}
            </DropdownMenuItem>
          ) : null}
          {menuMove || refundable || onRequestBalance ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem
            disabled={!previousId}
            render={previousId ? <Link href={`/orders/${previousId}`} /> : undefined}
          >
            <ChevronLeftIcon aria-hidden="true" /> {copy.previous}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!nextId}
            render={nextId ? <Link href={`/orders/${nextId}`} /> : undefined}
          >
            <ChevronRightIcon aria-hidden="true" /> {copy.next}
          </DropdownMenuItem>
          {cancellable ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmCancel(true)}>
                {copy.actions.cancel}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.cancelDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.cancelDialog.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.cancelDialog.keep}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              tone="destructive"
              onClick={() => {
                setConfirmCancel(false)
                onMove('cancelled')
              }}
            >
              {copy.cancelDialog.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
