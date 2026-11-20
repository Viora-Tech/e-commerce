'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import { gstAlreadyInvoicedContent } from '@/data/gst-already-invoiced'
import { gstQueuePageContent } from '@/data/gst-queue-page'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { QueueRow as Row } from './queue-page'
import { CELL } from './table-classes'

type QueueRowProps = {
  row: Row
  picked: boolean
  busy: boolean
  onPick: (on: boolean) => void
  /** Issue just this one (through the review step, which confirms its date). */
  onIssue: () => void
  /** "Already invoiced": record the invoice this order got outside Koomerce. */
  onRecord: () => void
}

const TONE: Record<Row['status'], ChipTone> = {
  ready: 'success',
  ready_b2b: 'info',
  ready_export: 'info',
  hsn_missing: 'attention',
  buyer_details: 'attention',
}

/** Where a row's Fix goes: the product missing an HSN code, or the order for buyer details. */
const fixHref = (row: Row) =>
  row.fix?.kind === 'product'
    ? routes.products.detail(row.fix.productId)
    : routes.orders.detail(row.orderId)

/** One queued draft: order and when it joined, customer, GSTIN, taxable, GST, status, Issue or Fix. */
export default function QueueRow({ row, picked, busy, onPick, onIssue, onRecord }: QueueRowProps) {
  // Hooks
  const copy = useCopy(gstQueuePageContent)
  const recordCopy = useCopy(gstAlreadyInvoicedContent)
  const fmt = useFormat()

  // Render logic
  const ready = row.status.startsWith('ready')
  const fixHelp =
    row.status === 'hsn_missing' || row.status === 'buyer_details'
      ? copy.fixHelp[row.status]
      : undefined
  const joined = row.eligibleAt ?? row.placedAt
  const first = row.items[0]
  const itemList = row.items.map((i) => `${i.title} × ${i.quantity}`).join(', ')

  return (
    <TableRow>
      <TableCell className={`${CELL} w-10`}>
        <Checkbox
          checked={picked}
          aria-label={copy.selectRow(row.orderName)}
          onCheckedChange={(v) => onPick(Boolean(v))}
        />
      </TableCell>
      <TableCell className={CELL}>
        <span className="flex flex-col">
          <Link href={routes.orders.detail(row.orderId)} className="font-medium hover:underline">
            {row.orderName}
          </Link>
          {joined ? (
            <span className="text-caption text-muted-foreground">{fmt.when(joined)}</span>
          ) : null}
        </span>
      </TableCell>
      {/* What it bills: the first item, then "+ n more" (owner, 18 Nov 2026). */}
      <TableCell className={`${CELL} max-w-64`}>
        <span className="flex flex-col" title={itemList}>
          <span className="line-clamp-1">{first ? `${first.title} × ${first.quantity}` : ''}</span>
          {row.items.length > 1 ? (
            <span className="text-caption text-muted-foreground">
              {copy.moreItems(row.items.length - 1)}
            </span>
          ) : null}
        </span>
      </TableCell>
      <TableCell className={CELL}>
        <span className="flex flex-col">
          {row.buyerName}
          <span className="text-caption text-muted-foreground">{row.buyerPlace || row.export}</span>
        </span>
      </TableCell>
      <TableCell className={`${CELL} font-mono text-caption`}>
        {row.buyerGstin ?? copy.none}
      </TableCell>
      <TableCell className={`${CELL} text-right tabular-nums`}>
        {fmt.moneyWhole(row.taxablePaise)}
      </TableCell>
      <TableCell className={`${CELL} text-right tabular-nums`}>
        {fmt.moneyWhole(row.gstPaise)}
      </TableCell>
      <TableCell className={CELL}>
        <span title={fixHelp}>
          <StatusChip tone={TONE[row.status]}>{copy.statuses[row.status]}</StatusChip>
        </span>
      </TableCell>
      <TableCell className={`${CELL} text-right`}>
        <span className="inline-flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            aria-label={recordCopy.actionLabel(row.orderName)}
            onClick={onRecord}
          >
            {recordCopy.action}
          </Button>
          {ready ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={onIssue}>
              {copy.issue}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              title={fixHelp}
              nativeButton={false}
              render={<Link href={fixHref(row)} />}
            >
              {copy.fix}
            </Button>
          )}
        </span>
      </TableCell>
    </TableRow>
  )
}
