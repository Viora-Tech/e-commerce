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

type BookShipmentsPanelProps = { onBooked: () => void }

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

/** Paste order numbers, set defaults, book with the store's courier. Partial failure shows per order. */
export default function BookShipmentsPanel({ onBooked }: BookShipmentsPanelProps) {
  // Hooks
  const [numbersInput, setNumbersInput] = useState('')
  const [weightGrams, setWeightGrams] = useState('500')
  const [length, setLength] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [insured, setInsured] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.shipments.bulkBook>> | null>(
    null,
  )

  // Event handlers
  const handleBook = async () => {
    const numbers = parseNumbers(numbersInput)
    if (numbers.length === 0) {
      toast.error(copy.noOrders)
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const matched = await api.shipments.resolveOrderNumbers({ numbers })
      if (matched.length === 0) {
        toast.error(copy.noOrders)
        return
      }
      const dims =
        length && width && height
          ? { length: Number(length), width: Number(width), height: Number(height) }
          : undefined
      const r = await api.shipments.bulkBook({
        orderIds: matched.map((m) => m.id),
        weightGrams: weightGrams ? Number(weightGrams) : undefined,
        dimensionsCm: dims,
        insured,
      })
      setResult(r)
      setNumbersInput('')
      onBooked()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
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
        <Button className="w-fit" onClick={handleBook} disabled={busy}>
          {busy ? copy.booking : copy.submit}
        </Button>
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
