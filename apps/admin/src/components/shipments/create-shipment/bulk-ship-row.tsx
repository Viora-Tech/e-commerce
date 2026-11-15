'use client'

import { Pencil } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import type { MouseEvent } from 'react'
import StatusChip from '@/components/layout/status-chip'
import { bulkShipContent } from '@/data/bulk-ship'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { problemText } from './bulk-problem-text'
import { type BulkLine, type BulkRule, type OrderEdit, pickSource } from './bulk-ship-state'
import CourierMark from './courier-mark'
import type { ShipmentDraft } from './flow-state'

type BulkShipRowProps = {
  line: BulkLine
  edit: OrderEdit | undefined
  rule: BulkRule
  boxes: ShipmentDraft['boxes']
  ticked: boolean
  onTick: (on: boolean) => void
  /** Opens the order's edit in place under its row (Figma 913:9698): Change, the fix buttons,
   *  the pencil and a click on the row itself. */
  onEdit: () => void
  /** The row's editor is open under it: the pencil closes it again. */
  expanded?: boolean | undefined
  /** Closes the open editor without applying (the pencil, pressed again). */
  onCollapse?: (() => void) | undefined
  /** "Ask to pay online" for a COD order no courier takes: sends the shopper a payment link. */
  onAskPayOnline: () => void
  /** A request is on its way: the fix button waits. */
  busy?: boolean | undefined
}

const SHORT_DATE = { weekday: 'short', day: 'numeric', month: 'short' } as const

/** "Riya Sharma" → "Riya S.", as the frame's order column shows the customer. */
const shortName = (name: string | null) => {
  const [first, last] = (name ?? '').trim().split(/\s+/)
  return first ? (last ? `${first} ${last[0]}.` : first) : ''
}

const kg = (grams: number) => Math.round(grams / 10) / 100

/** Clicks on these inside the row do their own thing, not open the editor. */
const INTERACTIVE = 'button, a, input, label, select, textarea, [role="checkbox"]'

/** The pencil's id, so focus can go back to it when the row's editor closes. */
export const editButtonId = (orderId: string) => `bulk-edit-${orderId}`

/** A blocked order cannot be booked from here, so it has no editor. */
const canEdit = (line: BulkLine) => !(line.status === 'problem' && line.problem?.kind === 'blocked')

/** One order of the bulk ship table (Figma 908:8804). A problem row stays, unticked, with the
 *  button that fixes it in place of Ready. */
export default function BulkShipRow({
  line,
  edit,
  rule,
  boxes,
  ticked,
  onTick,
  onEdit,
  onAskPayOnline,
  busy = false,
  expanded = false,
  onCollapse,
}: BulkShipRowProps) {
  // Hooks
  const copy = useCopy(bulkShipContent)
  const blockedCopy = useCopy(createShipmentContent.bulkPackage.blocked)
  const fmt = useFormat()

  // Event handlers
  /** A click on the row opens its editor, unless it landed on one of the row's own controls. */
  const handleRowClick = (e: MouseEvent<HTMLTableRowElement>) => {
    if (!canEdit(line) || expanded) return
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return
    onEdit()
  }

  // Render logic
  const { order, parcel, pick, problem, quote } = line
  const units = parcel?.lines.reduce((n, l) => n + l.quantity, 0) ?? 0
  const partial = parcel && units < order.unitsOrdered ? units : null
  const boxName =
    (edit?.boxId ? boxes.find((b) => b.id === edit.boxId)?.name : undefined) ??
    (edit?.dimensionsCm ? copy.customBox : undefined) ??
    parcel?.boxName ??
    (parcel?.dimensionsCm ? copy.ownBox : null)
  const grams = pick?.chargeableWeightGrams ?? quote?.chargedWeightGrams ?? null
  const weightLine =
    grams !== null
      ? copy.charged(fmt.number(kg(grams)))
      : parcel
        ? copy.kg(fmt.number(kg(edit?.weightGrams ?? parcel.weightGrams)))
        : null
  const needsPackage = problem?.kind === 'needs_package'
  const source = pickSource(line, rule)
  const hint =
    source === 'shopper'
      ? copy.source.shopper
      : source === 'hand'
        ? copy.source.hand
        : source === 'rule'
          ? copy.rules[rule]
          : source === 'via' && pick
            ? copy.source.via(pick.providerName)
            : copy.source.own
  const choice = order.deliveryChoice
  const choiceLine =
    choice && source !== 'shopper'
      ? copy.shopperChose(
          choice.name,
          choice.pricePaise > 0 ? fmt.money(choice.pricePaise) : copy.free,
        )
      : null
  const said = problem ? problemText(problem, copy, blockedCopy) : null
  const muted = line.status === 'problem'
  const noCod = problem?.kind === 'no_cod'
  // Asked already: the shopper has the link, the order waits for their payment.
  const waitingOnline = noCod && order.payOnlineRequestedAt !== null

  return (
    <TableRow
      className={cn('align-middle', muted && 'bg-muted/20', expanded && 'bg-muted/30')}
      data-expanded={expanded || undefined}
      onClick={handleRowClick}
    >
      <TableCell className="w-10 py-4 pl-4">
        <Checkbox
          checked={ticked}
          disabled={line.status !== 'ready'}
          aria-label={copy.selectOrder(order.orderNumber)}
          onCheckedChange={(v) => onTick(Boolean(v))}
        />
      </TableCell>
      <TableCell className="py-4">
        <p className="font-medium text-ink-strong">#{order.orderNumber}</p>
        <p className="text-caption text-muted-foreground">{shortName(order.customerName)}</p>
      </TableCell>
      <TableCell className="py-4 text-ink-strong">
        {[order.city, order.pincode].filter(Boolean).join(' ') || '—'}
      </TableCell>
      <TableCell className="py-4">
        {needsPackage ? (
          <div className="flex flex-col text-caption text-danger">
            <span>{boxName ?? copy.noBox}</span>
            <span>{copy.weightMissing}</span>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-1">
            <span className="text-ink-strong">{boxName ?? copy.noBox}</span>
            {weightLine ? (
              <span className="text-caption text-muted-foreground tabular-nums">{weightLine}</span>
            ) : null}
            {partial !== null ? (
              <StatusChip tone="info" variant="outline">
                {copy.shipsPart(partial, order.unitsOrdered)}
              </StatusChip>
            ) : null}
          </div>
        )}
      </TableCell>
      <TableCell className="py-4">
        <div className="flex flex-col items-start gap-1">
          <StatusChip tone={line.paymentMode === 'cod' ? 'attention' : 'neutral'} variant="outline">
            {line.paymentMode === 'cod' ? copy.cod : copy.prepaid}
          </StatusChip>
          <span className="text-caption text-muted-foreground tabular-nums">
            {fmt.money(parcel?.valuePaise ?? order.totalPaise)}
          </span>
        </div>
      </TableCell>
      {line.status === 'checking' ? (
        <TableCell colSpan={3} className="py-4 text-caption text-muted-foreground">
          <span className="flex items-center gap-2">
            <Spinner className="size-3.5" />
            {copy.checking}
          </span>
        </TableCell>
      ) : pick ? (
        <>
          <TableCell className="py-4">
            <div className="flex items-center gap-3">
              <CourierMark label={pick.providerLabel} />
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-ink-strong">{pick.providerLabel}</span>
                <span className="text-caption text-muted-foreground">
                  {hint} ·{' '}
                  <button
                    type="button"
                    onClick={onEdit}
                    className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {copy.change}
                  </button>
                </span>
                {choiceLine ? (
                  <span className="text-caption text-muted-foreground/80">{choiceLine}</span>
                ) : null}
              </div>
            </div>
          </TableCell>
          <TableCell className="py-4 whitespace-nowrap text-ink-strong">
            {pick.deliveryBy ? fmt.pattern(pick.deliveryBy, SHORT_DATE) : copy.noDate}
          </TableCell>
          <TableCell className="py-4 font-semibold whitespace-nowrap text-ink-strong tabular-nums">
            {pick.pricePaise === null ? (
              <span className="text-caption font-normal text-muted-foreground">
                {copy.rateOnBooking}
              </span>
            ) : (
              fmt.money(pick.pricePaise)
            )}
          </TableCell>
        </>
      ) : (
        <>
          <TableCell className="py-4 text-caption text-danger">
            {said?.text}
            {choiceLine ? (
              <span className="block text-muted-foreground/80">{choiceLine}</span>
            ) : null}
          </TableCell>
          <TableCell className="py-4 text-muted-foreground">—</TableCell>
          <TableCell className="py-4 text-muted-foreground">—</TableCell>
        </>
      )}
      <TableCell className="py-4 text-right">
        {line.status === 'ready' ? (
          <StatusChip tone="success" variant="outline">
            {copy.ready}
          </StatusChip>
        ) : waitingOnline ? (
          <StatusChip tone="info" variant="outline">
            {copy.waitingOnline}
          </StatusChip>
        ) : said?.fix ? (
          <Button
            size="sm"
            variant="outline"
            disabled={noCod && busy}
            onClick={noCod ? onAskPayOnline : onEdit}
          >
            {said.fix}
          </Button>
        ) : null}
      </TableCell>
      <TableCell className="w-12 py-4 pr-4 text-right">
        {canEdit(line) ? (
          <Button
            id={editButtonId(order.orderId)}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={copy.edit(order.orderNumber)}
            aria-expanded={expanded}
            title={copy.columns.edit}
            onClick={expanded && onCollapse ? onCollapse : onEdit}
          >
            <Pencil aria-hidden="true" />
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  )
}
