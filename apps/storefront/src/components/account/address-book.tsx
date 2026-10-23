'use client'

import type { SavedAddress } from '@commerce/core'
import { useState, useTransition } from 'react'
import { accountContent } from '@/data/account'
import { INDIAN_STATES } from '@/data/indian-states'
import { defaultAddressAction, deleteAddressAction } from '@/lib/account-actions'
import AddressForm from './address-form'
import StatusPill from './status-pill'

type AddressBookProps = { addresses: SavedAddress[] }

const copy = accountContent.addresses

const stateName = (code: string) => INDIAN_STATES.find(([c]) => c === code)?.[1] ?? code

/** Saved addresses as cards with edit, default and delete; one form open at a time. */
export default function AddressBook({ addresses }: AddressBookProps) {
  // Hooks
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [pending, start] = useTransition()

  // Event handlers
  const handleDelete = (id: string) => {
    if (!window.confirm(copy.confirmDelete)) return
    start(() => deleteAddressAction(id))
  }

  const handleDefault = (id: string) => {
    start(() => defaultAddressAction(id))
  }

  const handleDone = () => setEditing(null)

  // Render logic
  const adding = editing === 'new'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="h3">{copy.title}</h2>
        {adding ? null : (
          <button
            type="button"
            className="btn btn--primary btn--small"
            onClick={() => setEditing('new')}
          >
            {copy.add}
          </button>
        )}
      </div>

      {adding ? (
        <AddressForm address={null} defaultChecked={addresses.length === 0} onDone={handleDone} />
      ) : null}

      {addresses.length === 0 && !adding ? (
        <div className="flex flex-col items-start gap-2 rounded-[var(--radius-card)] bg-surface p-8">
          <h3 className="h4">{copy.emptyTitle}</h3>
          <p className="text-body text-muted">{copy.emptyBody}</p>
        </div>
      ) : null}

      <ul className={`grid gap-4 md:grid-cols-2 ${pending ? 'opacity-60' : ''}`}>
        {addresses.map((a) =>
          editing === a.id ? (
            <li key={a.id} className="md:col-span-2">
              <AddressForm address={a} defaultChecked={a.isDefault} onDone={handleDone} />
            </li>
          ) : (
            <li
              key={a.id}
              className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <address className="text-body not-italic">
                  <span className="font-semibold">{a.name}</span>
                  <br />
                  {a.line1}
                  {a.line2 ? (
                    <>
                      <br />
                      {a.line2}
                    </>
                  ) : null}
                  <br />
                  {a.city}, {stateName(a.stateCode)} {a.pincode}
                  <br />
                  {a.phone}
                </address>
                {a.isDefault ? <StatusPill label={copy.default} tone="neutral" /> : null}
              </div>
              <div className="mt-auto flex flex-wrap gap-4 text-small">
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={() => setEditing(a.id)}
                >
                  {copy.edit}
                </button>
                {a.isDefault ? null : (
                  <button
                    type="button"
                    className="underline underline-offset-4"
                    onClick={() => handleDefault(a.id)}
                    disabled={pending}
                  >
                    {copy.makeDefault}
                  </button>
                )}
                <button
                  type="button"
                  className="text-danger underline underline-offset-4"
                  onClick={() => handleDelete(a.id)}
                  disabled={pending}
                >
                  {copy.delete}
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}
