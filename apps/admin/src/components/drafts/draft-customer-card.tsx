'use client'

import { Search } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  addressToForm,
  type DraftFormState,
  EMPTY_BILLING,
} from '@/components/drafts/draft-form-state'
import DataCard from '@/components/layout/data-card'
import { draftEditorContent } from '@/data/drafts'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type DraftCustomerCardProps = {
  form: DraftFormState
  onChange: (patch: Partial<DraftFormState>) => void
}

type Customer = Awaited<ReturnType<typeof api.customers.list>>['items'][number]

type Found = NonNullable<Awaited<ReturnType<typeof api.customers.get>>>

type SavedAddress = Found['addresses'][number]

/**
 * The draft's addresses from the customer's book: shipping from their default shipping address,
 * billing from their default billing one (else it follows shipping). A billing default that is
 * another address, or carries a company or GSTIN, fills the billing card. A guest who checked out
 * without saving an address book still has the address of their last order
 * (`customer.default_address`), which fills shipping; nothing saved, nothing changes.
 */
function addressesFrom(found: Found): Partial<DraftFormState> {
  const book: readonly SavedAddress[] = found.addresses
  const ship = book.find((a) => a.isDefault) ?? book[0]
  if (!ship) {
    const last = found.defaultAddress
    if (!last?.line1) return {}
    return {
      address: addressToForm({ ...last, line2: last.line2 ?? null, phone: last.phone ?? '' }),
    }
  }
  const bill = book.find((a) => a.isDefaultBilling) ?? ship
  const separate = bill.id !== ship.id || Boolean(bill.gstin || bill.businessName)
  return {
    address: addressToForm(ship),
    billingSameAsShipping: !separate,
    billing: separate
      ? { ...addressToForm(bill), businessName: bill.businessName ?? '', gstin: bill.gstin ?? '' }
      : { ...EMPTY_BILLING },
  }
}

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
    if (found) onChange(addressesFrom(found))
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
    if (form.address.line1.trim()) return
    const found = await api.customers.get({ id: c.id }).catch(() => null)
    if (found) onChange(addressesFrom(found))
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
        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={copy.customer.search}
            className="pl-9 [&::-webkit-search-cancel-button]:hidden"
            type="search"
            name="draft-customer-lookup"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
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
