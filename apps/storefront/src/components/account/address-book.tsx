'use client'

import type { SavedAddress } from '@commerce/core'
import type { CSSProperties } from 'react'
import { useState, useTransition } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { accountContent } from '@/data/account'
import { INDIAN_STATES } from '@/data/indian-states'
import { defaultAddressAction, deleteAddressAction } from '@/lib/account-actions'
import {
  ACCOUNT_CARD,
  ACCOUNT_CARD_TITLE,
  ACCOUNT_LINK,
  ACCOUNT_LINK_DANGER,
  ACCOUNT_STAGGER,
} from '@/lib/account-classes'
import { CK_BUTTON_SECONDARY, CK_CARD, CK_LIFT } from '@/lib/checkout-classes'
import AccountPageHead from './account-page-head'
import AddressForm from './address-form'
import StatusPill from './status-pill'

type AddressBookProps = { addresses: SavedAddress[] }

const copy = accountContent.addresses

const stateName = (code: string) => INDIAN_STATES.find(([c]) => c === code)?.[1] ?? code

/**
 * Saved addresses as cards in the checkout's look, with Edit, Set as default and Delete; one
 * form open at a time. The default address comes first, as the checkout's address book.
 */
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
  const sorted = [...addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
  const addButton = adding ? null : (
    <button
      type="button"
      className={`${CK_BUTTON_SECONDARY} w-full sm:w-auto`}
      onClick={() => setEditing('new')}
    >
      <CheckoutIcon name="plus" className="size-4" />
      {copy.add}
    </button>
  )

  return (
    <>
      <AccountPageHead title={copy.title} intro={copy.intro} action={addButton} />
      <div className="flex flex-col gap-4">
        {adding ? (
          <AddressForm address={null} defaultChecked={addresses.length === 0} onDone={handleDone} />
        ) : null}

        {addresses.length === 0 && !adding ? (
          <div
            className={`${CK_CARD} ${CK_LIFT} flex flex-col items-center gap-3 px-6 py-10 text-center`}
          >
            <span className="grid size-12 place-items-center rounded-full bg-ck-soft text-ck-muted">
              <CheckoutIcon name="pin" className="size-5" />
            </span>
            <h2 className={ACCOUNT_CARD_TITLE}>{copy.emptyTitle}</h2>
            <p className="max-w-[22rem] text-[0.9375rem] text-ck-muted">{copy.emptyBody}</p>
          </div>
        ) : null}

        <ul
          className={`grid gap-3 sm:gap-4 md:grid-cols-2 ${pending ? 'opacity-60 motion-safe:transition-opacity' : ''}`}
          aria-busy={pending || undefined}
        >
          {sorted.map((a, i) =>
            editing === a.id ? (
              <li key={a.id} className="md:col-span-2">
                <AddressForm address={a} defaultChecked={a.isDefault} onDone={handleDone} />
              </li>
            ) : (
              <li
                key={a.id}
                style={{ '--i': i } as CSSProperties}
                className={`${ACCOUNT_CARD} ${ACCOUNT_STAGGER} gap-3!`}
              >
                <div className="flex items-start justify-between gap-3">
                  <address className="min-w-0 text-[0.9375rem] leading-relaxed text-ck-ink not-italic">
                    <span className="block font-semibold">{a.name}</span>
                    <span className="block text-ck-muted">
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ''}
                    </span>
                    <span className="block text-ck-muted">
                      {a.city}, {stateName(a.stateCode)} {a.pincode}
                    </span>
                    <span className="block text-ck-muted tabular-nums">{a.phone}</span>
                  </address>
                  {a.isDefault ? <StatusPill label={copy.default} tone="neutral" /> : null}
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-0 border-t border-ck-line pt-1">
                  <button
                    type="button"
                    className={ACCOUNT_LINK}
                    onClick={() => setEditing(a.id)}
                    disabled={pending}
                  >
                    <CheckoutIcon name="edit" className="size-3.5" />
                    {copy.edit}
                  </button>
                  {a.isDefault ? null : (
                    <button
                      type="button"
                      className={ACCOUNT_LINK}
                      onClick={() => handleDefault(a.id)}
                      disabled={pending}
                    >
                      <CheckoutIcon name="check" className="size-3.5" />
                      {copy.makeDefault}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${ACCOUNT_LINK_DANGER} ms-auto`}
                    onClick={() => handleDelete(a.id)}
                    disabled={pending}
                  >
                    <CheckoutIcon name="trash" className="size-3.5" />
                    {copy.delete}
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      </div>
    </>
  )
}
