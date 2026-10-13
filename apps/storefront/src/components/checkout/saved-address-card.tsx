'use client'

import type { SavedAddress } from '@commerce/core'
import { useEffect, useRef, useState } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content, INDIAN_STATES } from '@/data/checkout'
import { CK_LINK } from '@/lib/checkout-classes'
import { displayPhone } from '@/lib/checkout-recap'

type SavedAddressCardProps = {
  address: SavedAddress
  checked: boolean
  /** The courier's word on the picked address ("Delivers to 302001"), or null. */
  status: { text: string; ok: boolean } | null
  /** Saving or deleting is in flight: the buttons wait. */
  busy: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

const book = content.addressBook
const ICON_BUTTON =
  'flex size-9 cursor-pointer items-center justify-center rounded-ck bg-transparent! p-0! text-ck-muted outline-none transition-colors duration-150 hover:bg-ck-soft! hover:text-ck-ink focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none'

const stateName = (code: string): string => INDIAN_STATES.find(([c]) => c === code)?.[1] ?? code

/** "14 Rajpath Colony, C-Scheme, Jaipur, Rajasthan 302001" on one line. */
const oneLine = (a: SavedAddress): string =>
  [a.line1, a.line2, a.city, `${stateName(a.stateCode)} ${a.pincode}`].filter(Boolean).join(', ')

/**
 * One saved address as a radio card: name and its Home/Office tag, the address, the number,
 * and on the picked card whether the courier delivers there. Edit and Delete sit beside the
 * card's label (never inside it), so pressing them does not pick the card; Delete asks first.
 */
export default function SavedAddressCard({
  address,
  checked,
  status,
  busy,
  onSelect,
  onEdit,
  onDelete,
}: SavedAddressCardProps) {
  // Hooks
  const [confirming, setConfirming] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)

  // The trash button is gone once asked: focus moves to the answer.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus()
  }, [confirming])

  // Event handlers
  const handleDelete = () => {
    setConfirming(false)
    onDelete()
  }

  // Render logic
  const tag = address.label ? book.tags[address.label] : null

  return (
    <div
      className={`relative rounded-ck border bg-ck-field transition-[border-color,background-color,box-shadow] duration-150 has-[:focus-visible]:[box-shadow:0_0_0_3px_var(--ck-ring)] motion-reduce:transition-none ${
        checked
          ? 'border-ck-accent bg-ck-accent-soft [box-shadow:inset_0_0_0_1px_var(--ck-accent)]'
          : 'border-ck-line hover:border-ck-muted/50'
      }`}
    >
      <label className="flex cursor-pointer items-start gap-3.5 py-4 ps-4 pe-24">
        <input
          type="radio"
          name="saved-address"
          value={address.id}
          checked={checked}
          onChange={onSelect}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`mt-0.5 flex size-[1.125rem] shrink-0 items-center justify-center rounded-full border transition-colors duration-150 motion-reduce:transition-none ${
            checked ? 'border-ck-accent bg-ck-accent' : 'border-ck-muted/60 bg-ck-field'
          }`}
        >
          <span
            className={`size-1.5 rounded-full bg-ck-accent-ink ${checked ? 'opacity-100' : 'opacity-0'}`}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[0.9375rem] leading-snug font-medium text-ck-ink">
              {address.name}
            </span>
            {tag ? (
              <span className="rounded-full bg-ck-ink px-2 text-[0.6875rem] leading-5 font-semibold tracking-wide text-ck-bg uppercase">
                {tag}
              </span>
            ) : null}
          </span>
          <span className="text-[0.875rem] leading-snug text-ck-muted [overflow-wrap:anywhere]">
            {oneLine(address)}
          </span>
          <span className="text-[0.8125rem] text-ck-muted tabular-nums">
            {displayPhone(`+91${address.phone}`)}
          </span>
          {checked && status ? (
            <span
              role="status"
              className={`mt-1 flex items-center gap-1.5 text-[0.8125rem] ${status.ok ? 'text-ck-success' : 'text-ck-danger'}`}
            >
              <CheckoutIcon name={status.ok ? 'check' : 'alert'} className="size-3.5" />
              {status.text}
            </span>
          ) : null}
        </span>
      </label>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ck-line px-4 py-3 text-[0.8125rem]">
          <span className="text-ck-ink">{book.confirmRemove}</span>
          <button
            ref={confirmRef}
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className={`${CK_LINK} text-ck-danger!`}
          >
            {book.confirmYes}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={CK_LINK}>
            {book.confirmNo}
          </button>
        </div>
      ) : null}
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          aria-label={book.edit(address.name)}
          title={book.edit(address.name)}
          className={ICON_BUTTON}
        >
          <CheckoutIcon name="edit" className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy || confirming}
          aria-label={book.remove(address.name)}
          title={book.remove(address.name)}
          className={ICON_BUTTON}
        >
          <CheckoutIcon name="trash" className="size-4" />
        </button>
      </div>
    </div>
  )
}
