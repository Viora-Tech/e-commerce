'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
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
export default function QueueRow({ row, picked, busy, onPick, onIssue }: QueueRowProps) {
  // Hooks
  const copy = useCopy(gstQueuePageContent)
  const fmt = useFormat()

  // Render logic
  const ready = row.status.startsWith('ready')
  const fixHelp =
    row.status === 'hsn_missing' || row.status === 'buyer_details'
      ? copy.fixHelp[row.status]
      : undefined
  const joined = row.eligibleAt ?? row.placedAt

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
      </TableCell>
    </TableRow>
  )
}
