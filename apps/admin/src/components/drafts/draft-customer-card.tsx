'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  addressesFrom,
  contactPhoneFrom,
  type DraftFormState,
} from '@/components/drafts/draft-form-state'
import DataCard from '@/components/layout/data-card'
import RecordCombobox from '@/components/pickers/record-combobox'
import { draftEditorContent } from '@/data/drafts'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type DraftCustomerCardProps = {
  form: DraftFormState
  onChange: (patch: Partial<DraftFormState>) => void
}

type Customer = Awaited<ReturnType<typeof api.customers.list>>['items'][number]

const SEARCH_DEBOUNCE_MS = 250

export default function DraftCustomerCard({ form, onChange }: DraftCustomerCardProps) {
  // Hooks
  const copy = useCopy(draftEditorContent)
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
  const handlePick = async (c: Customer) => {
    onChange({
      customerId: c.id,
      customerName: c.name ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
    })
    setSearch('')
    setResults([])
    // Their saved addresses follow; a failed lookup leaves the address cards as they were.
    const found = await api.customers.get({ id: c.id }).catch(() => null)
    if (!found) return
    const addresses = addressesFrom(found)
    onChange({ ...addresses, phone: contactPhoneFrom(c.phone, found, addresses.address) })
  }

  /* An email typed by hand that belongs to a saved customer links them (issue 916): blank name
     and phone fill in, and an empty shipping address takes theirs. Typed details stay. */
  const handleEmailBlur = async () => {
    const email = form.email.trim().toLowerCase()
    if (form.customerId || !email.includes('@')) return
    const list = await api.customers.list({ page: 1, perPage: 6, search: email }).catch(() => null)
    const c = list?.items.find((x) => x.email?.toLowerCase() === email)
    if (!c) return
    onChange({
      customerId: c.id,
      customerName: form.customerName.trim() || (c.name ?? ''),
      phone: form.phone.trim() || (c.phone ?? ''),
    })
    toast.success(copy.customer.matched(c.name ?? c.email ?? email))
    const found = await api.customers.get({ id: c.id }).catch(() => null)
    if (!found) return
    const addresses = form.address.line1.trim() ? {} : addressesFrom(found)
    const phone = form.phone.trim() || contactPhoneFrom(c.phone, found, addresses.address)
    onChange({ ...addresses, phone })
  }

  const handleClear = () => {
    onChange({ customerId: null, customerName: '', email: '', phone: '' })
  }

  // Render logic
  return (
    <DataCard
      title={copy.customer.heading}
      action={
        form.customerId ? (
          <Button variant="ghost" size="sm" onClick={handleClear}>
            {copy.customer.clear}
          </Button>
        ) : null
      }
      bodyClassName="flex flex-col gap-4"
    >
      {form.customerId ? null : (
        // The matches float over the fields below while there are any.
        <RecordCombobox
          list="popover"
          open
          name="draft-customer-lookup"
          placeholder={copy.customer.search}
          query={search}
          onQueryChange={setSearch}
          items={results}
          itemKey={(c) => c.id}
          onPick={(c) => void handlePick(c)}
          renderItem={(c) => (
            <span className="flex min-w-0 flex-col items-start">
              <span className="text-body text-foreground">{c.name ?? c.email}</span>
              <span className="text-caption text-muted-foreground">{c.email}</span>
            </span>
          )}
        />
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
          onBlur={handleEmailBlur}
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
    </DataCard>
  )
}
