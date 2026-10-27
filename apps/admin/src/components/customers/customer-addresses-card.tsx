'use client'

import { Pencil, Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import { customerAddressesContent } from '@/data/customer-addresses'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { type AddressRole, splitAddressBook } from './address-roles'
import CustomerAddressBlock from './customer-address-block'
import CustomerAddressDialog from './customer-address-dialog'
import type { CustomerAddressRow, CustomerDetail } from './customer-detail-types'

type CustomerAddressesCardProps = {
  customer: CustomerDetail
  onChanged: () => void
}

type Editing = { address: CustomerAddressRow | null; role: AddressRole | null }

/**
 * The customer's shipping address and billing address, each with its own add or edit (with no
 * separate billing address, billing is the same as shipping), then any other saved addresses.
 * A customer who has only ever ordered as a guest has no book yet; their latest order's
 * address is shown and saving it puts it in the book.
 */
export default function CustomerAddressesCard({ customer, onChanged }: CustomerAddressesCardProps) {
  // Hooks
  const copy = useCopy(customerAddressesContent)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Helpers
  const run = async (change: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await change()
      toast.success(done)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.defaultFailed)
    } finally {
      setBusy(false)
    }
  }

  const editButton = (a: CustomerAddressRow) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      // The order snapshot is saved as a new shipping address.
      onClick={() => setEditing({ address: a, role: a.id ? null : 'shipping' })}
    >
      <Pencil aria-hidden="true" />
      {copy.edit}
    </Button>
  )
  const deleteButton = (a: CustomerAddressRow) =>
    a.id ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={copy.remove}
        onClick={() => setDeleting(a.id)}
      >
        <Trash2 />
      </Button>
    ) : null
  const addButton = (label: string, role: AddressRole) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setEditing({ address: null, role })}
    >
      <Plus aria-hidden="true" />
      {label}
    </Button>
  )

  // Event handlers
  const handleShipHere = (addressId: string) =>
    run(
      () => api.customers.setDefaultAddress({ customerId: customer.id, addressId }),
      copy.shipping.saved,
    )

  const handleBillHere = (addressId: string) =>
    run(
      () => api.customers.setDefaultBillingAddress({ customerId: customer.id, addressId }),
      copy.billing.saved,
    )

  /** Drop the separate billing address: billing goes back to the shipping address. */
  const handleBillToShipping = (a: CustomerAddressRow) =>
    run(() => {
      if (!a.id) return Promise.resolve()
      return api.customers.updateAddress({
        customerId: customer.id,
        addressId: a.id,
        address: {
          name: a.name,
          phone: a.phone ?? '',
          line1: a.line1,
          line2: a.line2 ?? '',
          city: a.city,
          stateCode: a.stateCode,
          pincode: a.pincode,
          isDefaultBilling: false,
        },
      })
    }, copy.billing.saved)

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
              isDefaultBilling: false,
              businessName: null,
              gstin: null,
            },
          ]
        : []
  const book = splitAddressBook(rows)
  return (
    <DataCard
      title={copy.heading}
      className="rounded-xl"
      action={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing({ address: null, role: book.shipping ? null : 'shipping' })}
        >
          <Plus aria-hidden="true" />
          {copy.add}
        </Button>
      }
      bodyClassName="flex flex-col divide-y divide-border"
    >
      <Section title={copy.shipping.heading}>
        {book.shipping ? (
          <CustomerAddressBlock
            address={book.shipping}
            actions={
              <>
                {book.shipping.id === null ? (
                  <span className="mr-auto text-caption text-muted-foreground">
                    {copy.fromOrder}
                  </span>
                ) : null}
                {editButton(book.shipping)}
                {deleteButton(book.shipping)}
              </>
            }
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-body text-muted-foreground">{copy.shipping.empty}</p>
            {addButton(copy.shipping.add, 'shipping')}
          </div>
        )}
      </Section>

      <Section title={copy.billing.heading}>
        {book.billing ? (
          <CustomerAddressBlock
            address={book.billing}
            actions={
              <>
                {book.shipping?.id ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => book.billing && handleBillToShipping(book.billing)}
                  >
                    {copy.billing.useShipping}
                  </Button>
                ) : null}
                {editButton(book.billing)}
                {deleteButton(book.billing)}
              </>
            }
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-body text-muted-foreground">{copy.billing.sameAsShipping}</p>
            {addButton(copy.billing.add, 'billing')}
          </div>
        )}
      </Section>

      {book.others.length > 0 ? (
        <Section title={copy.others}>
          <ul className="flex flex-col divide-y divide-border">
            {book.others.map((a) => (
              <li key={a.id ?? 'snapshot'} className="py-3 first:pt-0 last:pb-0">
                <CustomerAddressBlock
                  address={a}
                  actions={
                    a.id ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => a.id && handleShipHere(a.id)}
                        >
                          {copy.shipping.use}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => a.id && handleBillHere(a.id)}
                        >
                          {copy.billing.use}
                        </Button>
                        {editButton(a)}
                        {deleteButton(a)}
                      </>
                    ) : null
                  }
                />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {editing ? (
        <CustomerAddressDialog
          customerId={customer.id}
          address={editing.address}
          initialRole={editing.role}
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

/** One titled part of the card (shipping, billing, the rest). */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <h3 className="font-medium text-body">{title}</h3>
      {children}
    </section>
  )
}
