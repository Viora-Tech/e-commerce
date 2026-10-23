'use client'

import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { shipmentsContent } from '@/data/shipments'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type BookByNumberDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
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
export default function BookByNumberDialog({
  open,
  onOpenChange,
  onShip,
}: BookByNumberDialogProps) {
  // Hooks
  const copy = useCopy(shipmentsContent)
  const [numbersInput, setNumbersInput] = useState('')

  // Event handlers
  const handleFind = async () => {
    const numbers = parseNumbers(numbersInput)
    if (numbers.length === 0) {
      toast.error(copy.book.noOrders)
      return
    }
    try {
      const found = await api.shipments.resolveOrderNumbers({ numbers })
      if (found.length === 0) {
        toast.error(copy.book.noOrders)
        return
      }
      if (found.length < numbers.length)
        toast.info(copy.book.someMissing(numbers.length - found.length))
      setNumbersInput('')
      onShip(found.map((m) => m.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  // Render logic
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.byNumberSheet.title}
      description={copy.byNumberSheet.body}
      submitLabel={copy.book.submit}
      submitDisabled={numbersInput.trim() === ''}
      onSubmit={handleFind}
      size="md"
    >
      <Field>
        <FieldLabel htmlFor="book-orders">{copy.book.help}</FieldLabel>
        <Textarea
          id="book-orders"
          size="lg"
          rows={3}
          placeholder={copy.book.placeholder}
          value={numbersInput}
          onChange={(e) => setNumbersInput(e.target.value)}
        />
      </Field>
    </FormDialog>
  )
}
