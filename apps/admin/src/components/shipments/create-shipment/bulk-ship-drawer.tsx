'use client'

import { RefreshCw, TriangleAlert, XIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@commerce/ui/shadcn/drawer'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@commerce/ui/shadcn/table'
import { useState } from 'react'
import AppStoreLink from '@/components/apps/app-store-link'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { bulkShipContent } from '@/data/bulk-ship'
import { useCopy } from '@/hooks/use-copy'
import { BESIDE_SIDEBAR } from '@/lib/sidebar-motion'
import BulkEditDialog from './bulk-edit-dialog'
import BulkResult from './bulk-result'
import BulkShipFooter from './bulk-ship-footer'
import BulkShipRow from './bulk-ship-row'
import { BULK_RULES, type BulkRule, bulkSummary, isTicked } from './bulk-ship-state'
import { courierTotals } from './flow-state'
import { useBulkShip } from './use-bulk-ship'

type BulkShipDrawerProps = {
  /** The ticked orders; the drawer is open while there are two or more. */
  orderIds: string[]
  /** A courier's provider id to start on "One courier for all" (a courier app's action). */
  courier?: string | undefined
  onClose: () => void
  /** After a booking, so the page behind reloads. */
  onBooked: () => void
}

/**
 * Ship several orders (Figma 908:8804): a full-width bottom drawer with one table. Each order
 * gets its courier by the rule (Recommended, Cheapest, Fastest, One courier for all) or by
 * hand in its Edit popup (913:9698); a row that cannot book stays in the table, unticked, with
 * the button that fixes it. Booked, it turns into the result (909:9249): labels, skipped
 * orders and one pickup per courier.
 */
export default function BulkShipDrawer({
  orderIds,
  courier,
  onClose,
  onBooked,
}: BulkShipDrawerProps) {
  // Hooks
  const copy = useCopy(bulkShipContent)
  const b = useBulkShip(orderIds, courier)
  const [editing, setEditing] = useState<string | null>(null)

  // Event handlers
  const handleBook = async () => {
    if (await b.book()) onBooked()
  }
  const handleTickAll = (on: boolean) =>
    b.setUnticked(on ? new Set() : new Set(b.lines.map((l) => l.order.orderId)))

  // Render logic
  const open = orderIds.length > 1
  const draft = b.draft
  const summary = bulkSummary(b.lines, b.unticked)
  const ready = b.lines.filter((l) => l.status === 'ready')
  const allTicked = ready.length > 0 && ready.every((l) => isTicked(l, b.unticked))
  const totals = courierTotals(Object.values(b.quotes), draft?.couriers ?? [])

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} showSwipeHandle>
      <DrawerContent className={cn('mx-auto h-[calc(100dvh-4rem)] max-w-[90rem]', BESIDE_SIDEBAR)}>
        {b.results && draft ? (
          <BulkResult
            results={b.results}
            lines={b.lines}
            couriers={draft.couriers}
            onClose={onClose}
          />
        ) : (
          <>
            <DrawerHeader className="flex flex-row flex-wrap items-start justify-between gap-4 px-4 pt-2 text-left md:px-8">
              <div className="flex min-w-0 flex-col items-start gap-1 text-left">
                <DrawerTitle className="text-lg font-semibold text-ink-strong">
                  {copy.title(orderIds.length)}
                </DrawerTitle>
                <DrawerDescription className="text-body text-muted-foreground">
                  {copy.intro}
                </DrawerDescription>
              </div>
              <div className="flex items-start gap-3">
                <label
                  htmlFor="bulk-insurance"
                  className="flex cursor-pointer items-center gap-4 rounded-lg border border-border px-4 py-2.5"
                >
                  <span className="flex flex-col text-left">
                    <span className="text-body font-medium text-ink-strong">{copy.insurance}</span>
                    <span className="text-caption text-muted-foreground">
                      {b.insured ? copy.insuranceOn : copy.insuranceOff}
                    </span>
                  </span>
                  <Switch id="bulk-insurance" checked={b.insured} onCheckedChange={b.setInsured} />
                </label>
                <Button variant="ghost" size="icon-sm" aria-label={copy.close} onClick={onClose}>
                  <XIcon aria-hidden="true" />
                </Button>
              </div>
            </DrawerHeader>

            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-body text-ink-strong">{copy.ruleLabel}</span>
                {BULK_RULES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={b.rule === r}
                    onClick={() => b.setRule(r as BulkRule)}
                    className={cn(
                      'motion-press flex h-8 items-center rounded-full border px-3 text-body',
                      b.rule === r
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border text-ink-strong hover:bg-row-hover',
                    )}
                  >
                    {copy.rules[r]}
                  </button>
                ))}
                {b.rule === 'one' && totals.length > 0 ? (
                  <div className="w-64">
                    <ChoiceField
                      id="bulk-one-courier"
                      label={copy.oneCourier}
                      hideLabel
                      value={b.providerId ?? ''}
                      options={totals.map((t) => ({
                        value: t.providerId,
                        label: copy.oneCourierOption(t.label, t.canTake, b.lines.length),
                      }))}
                      onChange={(v) => b.setProviderId(v)}
                    />
                  </div>
                ) : null}
              </div>
              <p className="text-caption text-muted-foreground">{copy.pickupLater}</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {!draft ? (
                <p className="flex items-center gap-2 px-4 py-10 text-body text-muted-foreground md:px-8">
                  {b.failed ? null : <Spinner />}
                  {b.failed ? copy.loadFailed : copy.loading}
                </p>
              ) : (
                <>
                  {draft.couriers.length === 0 ? (
                    <div className="flex flex-col items-start gap-3 px-4 py-3 md:px-8">
                      <p className="text-body text-muted-foreground">{copy.noCourierConnected}</p>
                      <AppStoreLink category="shipping" className="w-fit">
                        {copy.connect}
                      </AppStoreLink>
                    </div>
                  ) : null}
                  {b.quoteError !== null ? (
                    <div
                      role="alert"
                      className="mx-4 mb-3 flex items-center gap-3 rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-body md:mx-8"
                    >
                      <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-danger" />
                      <span className="flex-1">
                        {copy.quoteFailed}{' '}
                        <span className="text-muted-foreground">{b.quoteError}</span>
                      </span>
                      <Button size="sm" variant="outline" onClick={b.recheck}>
                        <RefreshCw aria-hidden="true" />
                        {copy.retry}
                      </Button>
                    </div>
                  ) : null}
                  <div className="overflow-x-auto">
                    <Table className="min-w-[68rem]">
                      <TableHeader>
                        <TableRow className="bg-muted/50 text-caption tracking-wide uppercase">
                          <TableHead className="w-10 pl-4 md:pl-8">
                            <Checkbox
                              checked={allTicked}
                              disabled={ready.length === 0}
                              aria-label={copy.selectAll}
                              onCheckedChange={(v) => handleTickAll(Boolean(v))}
                            />
                          </TableHead>
                          <TableHead>{copy.columns.order}</TableHead>
                          <TableHead>{copy.columns.shipTo}</TableHead>
                          <TableHead>{copy.columns.package}</TableHead>
                          <TableHead>{copy.columns.payment}</TableHead>
                          <TableHead>{copy.columns.courier}</TableHead>
                          <TableHead>{copy.columns.delivery}</TableHead>
                          <TableHead>{copy.columns.charge}</TableHead>
                          <TableHead>
                            <span className="sr-only">{copy.columns.status}</span>
                          </TableHead>
                          <TableHead className="pr-4 md:pr-8">
                            <span className="sr-only">{copy.columns.edit}</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {b.lines.map((line) => (
                          <BulkShipRow
                            key={line.order.orderId}
                            line={line}
                            edit={b.edits[line.order.orderId]}
                            rule={b.rule}
                            boxes={draft.boxes}
                            ticked={isTicked(line, b.unticked)}
                            onTick={(on) => b.tick(line.order.orderId, on)}
                            onEdit={() => setEditing(line.order.orderId)}
                            onAskPayOnline={() => void b.askPayOnline(line.order.orderId)}
                            busy={b.busy}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>

            <BulkShipFooter
              summary={summary}
              insured={b.insured}
              wallets={b.wallets}
              busy={b.busy}
              onCancel={onClose}
              onBook={() => void handleBook()}
            />
            {draft ? (
              <BulkEditDialog
                lines={b.lines}
                orderId={editing}
                onOrderChange={setEditing}
                edits={b.edits}
                boxes={draft.boxes}
                unticked={b.unticked}
                onSave={b.saveEdit}
                onSkip={(orderId, skip) => b.tick(orderId, !skip)}
              />
            ) : null}
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
