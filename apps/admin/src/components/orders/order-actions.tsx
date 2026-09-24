'use client'

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontal,
  Printer,
  RotateCcw,
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
import { orderDetailContent as copy } from '@/data/orders'
import type { OrderStatus } from './order-detail-types'

type OrderActionsProps = {
  status: OrderStatus
  canRefund: boolean
  busy: boolean
  onMove: (to: OrderStatus) => void
  onRefund: () => void
  /** Imported history: only printing and stepping between orders. */
  readOnly?: boolean
  previousId?: string | undefined
  nextId?: string | undefined
}

/** The one forward step from each status; delivered and cancelled are terminal. */
const NEXT: Partial<Record<OrderStatus, { label: string; to: OrderStatus }>> = {
  placed: { label: copy.actions.markPaid, to: 'paid' },
  paid: { label: copy.actions.fulfil, to: 'fulfilled' },
  fulfilled: { label: copy.actions.deliver, to: 'delivered' },
}

/* Only these moves are the obvious next step and earn the ink button; "paid" is followed by
   packing, which the Unfulfilled section already offers, so it stays in the menu. */
const PRIMARY_FROM: ReadonlySet<OrderStatus> = new Set(['placed', 'fulfilled'])

export default function OrderActions({
  status,
  canRefund,
  busy,
  onMove,
  onRefund,
  readOnly = false,
  previousId,
  nextId,
}: OrderActionsProps) {
  // Hooks
  const [confirmCancel, setConfirmCancel] = useState(false)

  // Render logic
  const next = readOnly ? undefined : NEXT[status]
  const primary = next && PRIMARY_FROM.has(status) ? next : undefined
  const menuMove = next && !primary ? next : undefined
  const cancellable = !readOnly && status !== 'cancelled' && status !== 'delivered'
  const refundable = !readOnly && canRefund

  /* After the Saleor Dashboard order header (BSD-3): small square icon buttons, one menu for
     everything secondary, and at most one ink primary action. */
  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button
        variant="outline"
        size="icon"
        aria-label={copy.actions.print}
        title={copy.actions.print}
        onClick={() => window.print()}
      >
        <Printer aria-hidden="true" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon" aria-label={copy.actions.more} />}
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
          {menuMove || refundable ? <DropdownMenuSeparator /> : null}
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
      {primary ? (
        <Button onClick={() => onMove(primary.to)} disabled={busy}>
          {primary.label}
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
