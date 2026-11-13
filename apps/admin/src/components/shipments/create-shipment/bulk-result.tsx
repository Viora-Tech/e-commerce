'use client'

import { XIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { DrawerDescription, DrawerHeader, DrawerTitle } from '@commerce/ui/shadcn/drawer'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import { bulkShipContent } from '@/data/bulk-ship'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import BulkPickupsCard from './bulk-pickups-card'
import BulkPrintCard from './bulk-print-card'
import { problemText } from './bulk-problem-text'
import { type BookResult, type BulkLine, pickupGroups } from './bulk-ship-state'
import type { ShipmentDraft } from './flow-state'

type BulkResultProps = {
  results: BookResult[]
  lines: BulkLine[]
  couriers: ShipmentDraft['couriers']
  onClose: () => void
}

/**
 * After bulk booking (Figma 909:9249): Done, how many labels were booked, the labels and
 * packing slips to print, the orders skipped with the way to fix each, and the pickups, one per
 * courier, made now or later on Shipments › Booked.
 */
export default function BulkResult({ results, lines, couriers, onClose }: BulkResultProps) {
  // Hooks
  const copy = useCopy(bulkShipContent)
  const blockedCopy = useCopy(createShipmentContent.bulkPackage.blocked)

  // Render logic
  const r = copy.result
  const booked = results.filter((x) => x.ok)
  const byOrder = new Map(lines.map((l) => [l.order.orderId, l]))
  const skipped = results.filter((x) => !x.ok)
  const groups = pickupGroups(results, lines, couriers)

  return (
    <>
      <DrawerHeader className="flex flex-row items-start justify-between gap-4 px-4 pt-2 text-left md:px-8">
        <div className="flex min-w-0 flex-col items-start gap-1.5 text-left">
          <StatusChip tone="success">{r.done}</StatusChip>
          <DrawerTitle className="text-lg font-semibold text-ink-strong">
            {r.heading(booked.length)}
          </DrawerTitle>
          <DrawerDescription className="text-body text-muted-foreground">
            {r.intro(skipped.length)}
          </DrawerDescription>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label={copy.close} onClick={onClose}>
          <XIcon aria-hidden="true" />
        </Button>
      </DrawerHeader>
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain px-4 pb-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          <BulkPrintCard booked={booked} />
          {skipped.length > 0 ? (
            <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
              <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
                {r.skipped(skipped.length)}
              </p>
              <ul className="flex flex-col gap-3">
                {skipped.map((x) => {
                  const line = byOrder.get(x.orderId)
                  const said = line?.problem ? problemText(line.problem, copy, blockedCopy) : null
                  const where = [line?.order.city, line?.order.pincode].filter(Boolean).join(' ')
                  return (
                    <li key={x.orderId} className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-col">
                        <span className="font-medium text-ink-strong">
                          #{line?.order.orderNumber ?? '—'}
                          {where ? ` · ${where}` : ''}
                        </span>
                        <span className="text-caption text-muted-foreground">
                          {said?.text ?? x.error ?? r.notBooked}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={routes.orders.shipment(x.orderId)} />}
                      >
                        {said?.fix ?? copy.fix.change}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}
        </div>
        {groups.length > 0 ? <BulkPickupsCard groups={groups} onLater={onClose} /> : null}
      </div>
    </>
  )
}
