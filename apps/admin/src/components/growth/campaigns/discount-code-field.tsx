'use client'

import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { campaignEditorContent } from '@/data/marketing-campaigns'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type DiscountCodeFieldProps = {
  id: string
  value: string
  onChange: (code: string) => void
}

const copy = campaignEditorContent.fields

/** Picks an active code from Discounts, so an email never promises a code that does not work. */
export default function DiscountCodeField({ id, value, onChange }: DiscountCodeFieldProps) {
  // Hooks
  const [codes, setCodes] = useState<{ code: string; title: string }[] | null>(null)

  useEffect(() => {
    let live = true
    api.discounts.list({ page: 1, perPage: 100, lifecycle: 'active' }).then((r) => {
      if (!live) return
      setCodes(r.items.flatMap((d) => (d.code ? [{ code: d.code, title: d.title }] : [])))
    })
    return () => {
      live = false
    }
  }, [])

  // Render logic
  const options = codes ?? []
  const known = options.some((o) => o.code === value)
  const all = value && !known ? [{ code: value, title: value }, ...options] : options
  const items = Object.fromEntries(all.map((o) => [o.code, o.code]))

  return (
    <Field>
      <FieldLabel htmlFor={id}>{copy.code}</FieldLabel>
      <Select items={items} value={value || null} onValueChange={(v) => v && onChange(String(v))}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={copy.pickCode} />
        </SelectTrigger>
        <SelectContent>
          {all.map((o) => (
            <SelectItem key={o.code} value={o.code}>
              <span className="font-mono">{o.code}</span>
              <span className="ml-2 text-muted-foreground">{o.title}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {codes && codes.length === 0 ? (
        <FieldDescription>
          <Link href={routes.discounts.new()} className="underline">
            {copy.noCodes}
          </Link>
        </FieldDescription>
      ) : null}
    </Field>
  )
}
