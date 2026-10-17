'use client'

import { Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import CopyButton from '@/components/fields/copy-button'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { customerAddressesContent } from '@/data/customers'
import { INDIAN_STATES } from '@/data/india'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import CustomerAddressDialog from './customer-address-dialog'
import type { CustomerAddressRow, CustomerDetail } from './customer-detail-types'

type CustomerAddressesCardProps = {
  customer: CustomerDetail
  onChanged: () => void
}

const stateName = (code: string) => INDIAN_STATES.find((s) => s.code === code)?.name ?? code

function lines(a: CustomerAddressRow): string[] {
  return [
    a.name,
    a.line1,
    a.line2,
    a.city,
    `${stateName(a.stateCode)} ${a.pincode}`,
    a.phone,
  ].filter((l): l is string => Boolean(l))
}

/**
 * The customer's address book: add, edit, delete, pick the default. A customer
 * who has only ever ordered as a guest has no book yet; their latest order's
 * address is shown and saving it puts it in the book.
 */
export default function CustomerAddressesCard({ customer, onChanged }: CustomerAddressesCardProps) {
  // Hooks
  const copy = useCopy(customerAddressesContent)
  const [editing, setEditing] = useState<CustomerAddressRow | 'new' | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api.customers.deleteAddress({ customerId: customer.id, addressId: deleting })
      toast.success(copy.confirm.done)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.confirm.failed)
    } finally {
      setBusy(false)
      setDeleting(null)
    }
  }

  // Render logic
  const snapshot = customer.defaultAddress
  const rows: CustomerAddressRow[] =
    customer.addresses.length > 0
      ? customer.addresses
      : snapshot
        ? [
            {
              id: null,
              name: snapshot.name,
              line1: snapshot.line1,
              line2: snapshot.line2 ?? null,
              city: snapshot.city,
              stateCode: snapshot.stateCode,
              pincode: snapshot.pincode,
              phone: snapshot.phone ?? '',
              label: null,
              isDefault: true,
            },
          ]
        : []

  return (
    <DataCard
      title={copy.heading}
      className="rounded-xl"
      action={
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing('new')}>
          {copy.add}
        </Button>
      }
    >
      {rows.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((a) => (
            <li key={a.id ?? 'snapshot'} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <address className="min-w-0 text-body not-italic">
                  {lines(a).map((l) => (
                    <p key={l} className="break-words">
                      {l}
                    </p>
                  ))}
                </address>
                <CopyButton value={lines(a).join('\n')} what={copy.heading} visible />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {a.id === null ? (
                  <span className="text-caption text-muted-foreground">{copy.fromOrder}</span>
                ) : a.isDefault ? (
                  <StatusChip>{copy.default}</StatusChip>
                ) : null}
                <div className="ml-auto flex items-center gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(a)}>
                    {copy.edit}
                  </Button>
                  {a.id ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={copy.remove}
                      onClick={() => setDeleting(a.id)}
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <CustomerAddressDialog
          customerId={customer.id}
          address={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onChanged}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={copy.confirm.title}
        body={copy.confirm.body}
        confirmLabel={copy.confirm.confirm}
        cancelLabel={copy.confirm.cancel}
        busy={busy}
        onConfirm={handleDelete}
      />
    </DataCard>
  )
}
