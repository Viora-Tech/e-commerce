'use client'

import { Printer } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { bulkShipContent } from '@/data/bulk-ship'
import { labelSheetContent } from '@/data/label-sheet'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import LabelPaperSelect from '../label-paper-select'
import { useLabelSheet } from '../use-label-sheet'
import type { BookResult } from './bulk-ship-state'

type BulkPrintCardProps = {
  /** The bookings that went through. */
  booked: BookResult[]
}

/**
 * The bulk result's Print card (Figma 909:9249): every booked label in one file on the paper
 * picked (remembered for this member and store), and the packing slips.
 */
export default function BulkPrintCard({ booked }: BulkPrintCardProps) {
  // Hooks
  const copy = useCopy(bulkShipContent)
  const sheetCopy = useCopy(labelSheetContent)
  const sheet = useLabelSheet()

  // Event handlers
  const handlePrint = () => {
    void sheet.print(ids)
  }

  // Render logic
  const r = copy.result
  const ids = booked.flatMap((x) => (x.labelUrl && x.shipmentId ? [x.shipmentId] : []))
  const missing = booked.length - ids.length

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
        {r.print}
      </p>
      <p className="text-body text-ink-strong">{r.printHeading(booked.length)}</p>
      {ids.length === 0 ? (
        <p className="text-caption text-muted-foreground">{r.noLabels}</p>
      ) : missing > 0 ? (
        <p className="text-caption text-muted-foreground">{r.printMissing(missing)}</p>
      ) : null}
      <LabelPaperSelect value={sheet.format} onChange={sheet.setFormat} className="w-full" />
      <div className="flex flex-wrap gap-2">
        <Button onClick={handlePrint} disabled={ids.length === 0 || sheet.printing}>
          <Printer aria-hidden="true" />
          {sheet.printing ? sheetCopy.making : r.printLabels(ids.length)}
        </Button>
        <Button
          variant="outline"
          disabled={booked.length === 0}
          nativeButton={false}
          render={
            <Link href={routes.orders.packingSlips(booked.map((x) => x.orderId))} target="_blank" />
          }
        >
          {r.packingSlips}
        </Button>
      </div>
    </section>
  )
}
