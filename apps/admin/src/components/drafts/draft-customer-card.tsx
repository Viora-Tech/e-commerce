'use client'

import { Search } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import type { DraftFormState } from '@/components/drafts/draft-form-state'
import { draftEditorContent as copy } from '@/data/drafts'
import { api } from '@/lib/api-client'

type DraftCustomerCardProps = {
  form: DraftFormState
  onChange: (patch: Partial<DraftFormState>) => void
}

type Customer = Awaited<ReturnType<typeof api.customers.list>>['items'][number]

const SEARCH_DEBOUNCE_MS = 250

export default function DraftCustomerCard({ form, onChange }: DraftCustomerCardProps) {
  // Hooks
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Customer[]>([])

  useEffect(() => {
    const term = search.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      api.customers
        .list({ page: 1, perPage: 6, search: term })
        .then((r) => !cancelled && setResults(r.items))
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [search])

  // Event handlers
  const handlePick = (c: Customer) => {
    onChange({
      customerId: c.id,
      customerName: c.name ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
    })
    setSearch('')
    setResults([])
  }

  const handleClear = () => {
    onChange({ customerId: null, customerName: '', email: '', phone: '' })
  }

  // Render logic
  return (
    <Card gap={4} inset={5}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-kit-card-title text-foreground">{copy.customer.heading}</p>
        {form.customerId ? (
          <Button variant="ghost" size="sm" onClick={handleClear}>
            {copy.customer.clear}
          </Button>
        ) : null}
      </div>
      {form.customerId ? null : (
        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={copy.customer.search}
            className="pl-9"
          />
          {results.length > 0 ? (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card p-1 shadow-popover">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(c)}
                    className="flex w-full flex-col items-start rounded-md px-2 py-2 text-left hover:bg-muted"
                  >
                    <span className="text-body text-foreground">{c.name ?? c.email}</span>
                    <span className="text-caption text-muted-foreground">{c.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      <Field>
        <FieldLabel htmlFor="draft-customer-name">{copy.customer.name}</FieldLabel>
        <Input
          id="draft-customer-name"
          value={form.customerName}
          onChange={(e) => onChange({ customerName: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="draft-email">{copy.customer.email}</FieldLabel>
        <Input
          id="draft-email"
          type="email"
          value={form.email}
          onChange={(e) => onChange({ email: e.target.value })}
        />
        <p className="text-caption text-muted-foreground">{copy.customer.help}</p>
      </Field>
      <Field>
        <FieldLabel htmlFor="draft-phone">{copy.customer.phone}</FieldLabel>
        <Input
          id="draft-phone"
          value={form.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
        />
      </Field>
    </Card>
  )
}
