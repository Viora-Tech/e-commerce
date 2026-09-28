'use client'

import { Plus, Trash2 } from '@commerce/ui/icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@commerce/ui/shadcn/alert-dialog'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import CopyButton from '@/components/fields/copy-button'
import DataCard from '@/components/layout/data-card'
import { customerAddressesContent as copy } from '@/data/customers'
import { INDIAN_STATES } from '@/data/india'
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
              isDefault: true,
            },
          ]
        : []

  return (
    <DataCard
      title={copy.heading}
      action={
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing('new')}>
          <Plus />
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
                  <Badge variant="secondary">{copy.default}</Badge>
                ) : null}
                <div className="ml-auto flex items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditing(a)}>
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

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.confirm.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.confirm.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.confirm.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={handleDelete}>
              {copy.confirm.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DataCard>
  )
}
