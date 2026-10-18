'use client'

import { Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { shipmentsContent } from '@/data/shipments'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type BookShipmentsPanelProps = {
  /** The orders these numbers matched: the Create shipment flow takes it from here. */
  onShip: (orderIds: string[]) => void
}

function parseNumbers(raw: string): number[] {
  return [
    ...new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => Number.parseInt(s.replace('#', ''), 10))
        .filter(Number.isFinite),
    ),
  ]
}

/** Paste order numbers (cash on delivery orders To book doesn't list), then the same Create
 *  shipment flow as everywhere else: package, courier, review, book. */
export default function BookShipmentsPanel({ onShip }: BookShipmentsPanelProps) {
  // Hooks
  const copy = useCopy(shipmentsContent.book)
  const [numbersInput, setNumbersInput] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleFind = async () => {
    const numbers = parseNumbers(numbersInput)
    if (numbers.length === 0) {
      toast.error(copy.noOrders)
      return
    }
    setBusy(true)
    try {
      const found = await api.shipments.resolveOrderNumbers({ numbers })
      if (found.length === 0) {
        toast.error(copy.noOrders)
        return
      }
      if (found.length < numbers.length) toast.info(copy.someMissing(numbers.length - found.length))
      setNumbersInput('')
      onShip(found.map((m) => m.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

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
        <Button className="w-fit" onClick={handleFind} disabled={busy}>
          <Truck aria-hidden />
          {busy ? copy.finding : copy.submit}
        </Button>
      </div>
    </DataCard>
  )
}
