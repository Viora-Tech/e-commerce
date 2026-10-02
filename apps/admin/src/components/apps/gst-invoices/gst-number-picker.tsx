'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useEffect, useState } from 'react'
import { gstNumberPickerContent } from '@/data/gst-invoices'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Numbers = Awaited<ReturnType<typeof api.gstInvoices.gstNumbers>>

type GstNumberPickerProps = {
  /** The picked GST number's id; undefined is the store's main one (or every one, with `allowAll`). */
  value: string | undefined
  onChange: (id: string | undefined) => void
  /** Offer "All GST numbers" (lists); returns and GSTR-1 always work on one. */
  allowAll?: boolean
}

/** The select's value for "All GST numbers". */
const ALL = 'all'

/**
 * "GST number" at the top of the GST invoices pages. Each GST number numbers its own
 * invoices and files its own GSTR-1. Hidden while the store has one or none.
 */
export default function GstNumberPicker({ value, onChange, allowAll }: GstNumberPickerProps) {
  // Hooks
  const copy = useCopy(gstNumberPickerContent)
  const [numbers, setNumbers] = useState<Numbers | null>(null)

  useEffect(() => {
    api.gstInvoices
      .gstNumbers()
      .then(setNumbers)
      .catch(() => setNumbers(null))
  }, [])

  // Event handlers
  const handleChange = (next: string) => onChange(next === ALL ? undefined : next)

  // Early returns
  if (!numbers || numbers.numbers.length < 2) return null

  // Render logic
  const options = [
    ...(allowAll ? [{ value: ALL, label: copy.all }] : []),
    ...numbers.numbers.map((n) => ({
      value: n.id,
      label: [
        copy.option(n.stateName ?? n.stateCode ?? '', n.gstin),
        n.isDefault ? copy.main : null,
        n.active ? null : copy.cancelled,
      ]
        .filter(Boolean)
        .join(' '),
    })),
  ]
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]))
  const current = value ?? (allowAll ? ALL : (numbers.defaultId ?? ALL))

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor="gst-number" className="shrink-0 text-body text-muted-foreground">
        {copy.label}
      </label>
      <Select items={items} value={current} onValueChange={(v) => v && handleChange(String(v))}>
        <SelectTrigger id="gst-number" className="w-full min-w-0 sm:w-[19rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
