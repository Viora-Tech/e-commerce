'use client'

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
import { MoreHorizontal, Printer, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { orderDetailContent as copy } from '@/data/orders'
import type { OrderStatus } from './order-detail-types'

type OrderActionsProps = {
  status: OrderStatus
  canRefund: boolean
  busy: boolean
  onMove: (to: OrderStatus) => void
  onRefund: () => void
}

/** The one forward step from each status; delivered and cancelled are terminal. */
const NEXT: Partial<Record<OrderStatus, { label: string; to: OrderStatus }>> = {
  placed: { label: copy.actions.markPaid, to: 'paid' },
  paid: { label: copy.actions.fulfil, to: 'fulfilled' },
  fulfilled: { label: copy.actions.deliver, to: 'delivered' },
}

/** Header buttons: primary status move, refund, and the rest behind a menu. */
export default function OrderActions({
  status,
  canRefund,
  busy,
  onMove,
  onRefund,
}: OrderActionsProps) {
  // Hooks
  const [confirmCancel, setConfirmCancel] = useState(false)

  // Render logic
  const next = NEXT[status]
  const cancellable = status !== 'cancelled' && status !== 'delivered'

  return (
    <div className="flex items-center gap-2 print:hidden">
      {canRefund ? (
        <Button variant="outline" onClick={onRefund} disabled={busy}>
          <RotateCcw aria-hidden="true" /> {copy.actions.refund}
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon" />}>
          <MoreHorizontal aria-hidden="true" />
          <span className="sr-only">{copy.actions.more}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onClick={() => window.print()}>
            <Printer aria-hidden="true" /> {copy.actions.print}
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
      {next ? (
        <Button onClick={() => onMove(next.to)} disabled={busy}>
          {next.label}
        </Button>
      ) : null}

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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-destructive dark:text-destructive-foreground dark:hover:bg-destructive/90"
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
