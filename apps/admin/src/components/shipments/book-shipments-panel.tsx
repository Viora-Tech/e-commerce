'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { shipmentsContent } from '@/data/shipments'
import { api } from '@/lib/api-client'
import CourierCompareTable from './courier-compare-table'

type BookShipmentsPanelProps = { onBooked: () => void }
type MatchedOrder = Awaited<ReturnType<typeof api.shipments.resolveOrderNumbers>>[number]
type CompareRows = Awaited<ReturnType<typeof api.shipments.compareRates>>

const copy = shipmentsContent.book

function parseNumbers(raw: string): number[] {
  return [
    ...new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => Number.parseInt(s, 10))
        .filter(Number.isFinite),
    ),
  ]
}

/** Paste order numbers, preview the courier comparison (a no-op when only one courier is
 *  connected), then book. Partial failure shows per order. */
export default function BookShipmentsPanel({ onBooked }: BookShipmentsPanelProps) {
  // Hooks
  const [numbersInput, setNumbersInput] = useState('')
  const [weightGrams, setWeightGrams] = useState('500')
  const [length, setLength] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [insured, setInsured] = useState(false)
  const [busy, setBusy] = useState(false)
  const [matched, setMatched] = useState<MatchedOrder[] | null>(null)
  const [compareRows, setCompareRows] = useState<CompareRows | null>(null)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.shipments.bulkBook>> | null>(
    null,
  )

  // Helpers
  const book = async (orderIds: string[], courierOverrides: Record<string, string>) => {
    setBusy(true)
    try {
      const dims =
        length && width && height
          ? { length: Number(length), width: Number(width), height: Number(height) }
          : undefined
      const r = await api.shipments.bulkBook({
        orderIds,
        weightGrams: weightGrams ? Number(weightGrams) : undefined,
        dimensionsCm: dims,
        insured,
        courierOverrides: Object.keys(courierOverrides).length > 0 ? courierOverrides : undefined,
      })
      setResult(r)
      setNumbersInput('')
      setMatched(null)
      setCompareRows(null)
      setOverrides({})
      onBooked()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handlePreview = async () => {
    const numbers = parseNumbers(numbersInput)
    if (numbers.length === 0) {
      toast.error(copy.noOrders)
      return
    }
    setBusy(true)
    setResult(null)
    setCompareRows(null)
    setOverrides({})
    try {
      const found = await api.shipments.resolveOrderNumbers({ numbers })
      if (found.length === 0) {
        toast.error(copy.noOrders)
        return
      }
      setMatched(found)
      const rows = await api.shipments.compareRates({
        orderIds: found.map((m) => m.id),
        weightGrams: weightGrams ? Number(weightGrams) : undefined,
      })
      // More than one courier column across the batch is when the table earns its place;
      // a single-courier store skips straight to booking.
      const multiCourier = rows.some((r) => r.options.length > 1)
      if (multiCourier) {
        setCompareRows(rows)
      } else {
        await book(
          found.map((m) => m.id),
          {},
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmBook = () => {
    if (!matched) return
    void book(
      matched.map((m) => m.id),
      overrides,
    )
  }

  const handleOverrideChange = (orderId: string, providerId: string) => {
    setOverrides((prev) => {
      const next = { ...prev }
      if (providerId) next[orderId] = providerId
      else delete next[orderId]
      return next
    })
  }

  // Render logic
  const okCount = result?.filter((r) => r.ok).length ?? 0
  const failCount = result ? result.length - okCount : 0

  return (
    <DataCard title={copy.heading}>
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="book-orders">{copy.help}</FieldLabel>
          <Textarea
            id="book-orders"
            size="lg"
            rows={3}
            placeholder={copy.placeholder}
            value={numbersInput}
            onChange={(e) => setNumbersInput(e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field>
            <FieldLabel htmlFor="book-weight">{copy.weight}</FieldLabel>
            <Input
              id="book-weight"
              size="lg"
              type="number"
              value={weightGrams}
              onChange={(e) => setWeightGrams(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="book-length">{copy.length}</FieldLabel>
            <Input
              id="book-length"
              size="lg"
              type="number"
              value={length}
              onChange={(e) => setLength(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="book-width">{copy.width}</FieldLabel>
            <Input
              id="book-width"
              size="lg"
              type="number"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="book-height">{copy.height}</FieldLabel>
            <Input
              id="book-height"
              size="lg"
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </Field>
        </div>
        <Field orientation="horizontal">
          <Checkbox
            id="book-insure"
            checked={insured}
            onCheckedChange={(v) => setInsured(Boolean(v))}
          />
          <FieldLabel htmlFor="book-insure" className="font-normal">
            {copy.insure}
          </FieldLabel>
        </Field>
        {!compareRows ? (
          <Button className="w-fit" onClick={handlePreview} disabled={busy}>
            {busy ? copy.booking : copy.submit}
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-body font-medium text-foreground">{copy.compare.heading}</p>
              <p className="text-caption text-muted-foreground">{copy.compare.help}</p>
            </div>
            <CourierCompareTable
              rows={compareRows}
              overrides={overrides}
              onOverrideChange={handleOverrideChange}
            />
            <Button className="w-fit" onClick={handleConfirmBook} disabled={busy}>
              {busy ? copy.booking : copy.confirmBook(compareRows.length)}
            </Button>
          </div>
        )}
        {result ? (
          <p className="text-body text-muted-foreground">
            {copy.resultHeading}: {copy.ok(okCount)}
            {failCount > 0 ? `, ${copy.failed(failCount)}` : ''}
          </p>
        ) : null}
        {result?.filter((r) => !r.ok).length ? (
          <ul className="flex flex-col gap-1 text-caption text-destructive">
            {result
              .filter((r) => !r.ok)
              .map((r) => (
                <li key={r.orderId}>{r.error}</li>
              ))}
          </ul>
        ) : null}
      </div>
    </DataCard>
  )
}
