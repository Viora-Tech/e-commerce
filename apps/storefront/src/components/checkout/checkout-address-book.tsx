'use client'

import type { ReactNode } from 'react'
import CheckoutAddressFields from '@/components/checkout/checkout-address-fields'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import SavedAddressCard from '@/components/checkout/saved-address-card'
import { checkoutContent as content } from '@/data/checkout'
import { CK_BUTTON_PRIMARY, CK_BUTTON_SECONDARY, CK_HEADING } from '@/lib/checkout-classes'
import { NEW_ADDRESS } from '@/lib/checkout-form-state'
import { type CheckoutFormModel, SAVE_ADDRESS_ID } from '@/lib/use-checkout-form'

type CheckoutAddressBookProps = { ck: CheckoutFormModel }

type AddressPanelProps = {
  ck: CheckoutFormModel
  heading: string
  /** Editing a saved address (Save writes the book); a new one is saved with the order. */
  editing: boolean
  children: ReactNode
}

const book = content.addressBook

/**
 * Where the order goes. A signed-in shopper with saved addresses picks a card (Home/Office
 * tag, edit and delete on each, the courier's answer under the picked one) or adds a new one;
 * everyone else fills in the PIN-first form. Editing a card swaps it for the form with Save
 * and Cancel; Save writes the address book (`saveAddressAction`, the account page's own).
 */
export default function CheckoutAddressBook({ ck }: CheckoutAddressBookProps) {
  // Render logic
  const { addresses, customer, totals } = ck
  const cards = customer !== null && addresses.length > 0 && !totals.digitalOnly
  const delivery = ck.shipping?.delivery
  const status =
    ck.checking || !delivery?.ok
      ? null
      : ck.unserviceable
        ? { text: ck.deliveryText ?? content.delivery.unserviceable(delivery.pincode), ok: false }
        : { text: book.deliversTo(delivery.pincode), ok: true }
  const form = (
    <CheckoutAddressFields
      values={ck.form}
      errors={ck.shownErrors}
      digitalOnly={totals.digitalOnly}
      gstinEnabled={ck.settings.gstin}
      business={ck.business}
      deliveryText={ck.unserviceable ? null : ck.deliveryText}
      checking={ck.checking}
      onLabel={customer ? ck.handleLabel : null}
      onField={ck.set}
      onLeave={ck.handleLeave}
      onPincode={ck.handlePincode}
      onState={ck.handleState}
      onBusiness={ck.handleBusiness}
      onPlace={ck.handlePlace}
    />
  )
  // Early returns
  if (!cards) return form

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-3 border-0! p-0!">
        <legend className="sr-only">{book.legend}</legend>
        {addresses.map((a) =>
          ck.editingId === a.id ? (
            <AddressPanel key={a.id} ck={ck} heading={book.editHeading} editing>
              {form}
            </AddressPanel>
          ) : (
            <SavedAddressCard
              key={a.id}
              address={a}
              checked={ck.savedId === a.id && ck.editingId === null}
              status={status}
              busy={ck.savingAddress}
              onSelect={() => ck.handlePickAddress(a.id)}
              onEdit={() => ck.handleEdit(a.id)}
              onDelete={() => ck.handleDeleteAddress(a.id)}
            />
          ),
        )}
      </fieldset>
      {ck.savedId === NEW_ADDRESS ? (
        <AddressPanel ck={ck} heading={book.newHeading} editing={false}>
          {form}
        </AddressPanel>
      ) : (
        <button
          type="button"
          onClick={() => ck.handlePickAddress(NEW_ADDRESS)}
          className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-ck border border-dashed border-ck-line bg-transparent! text-[0.9375rem] font-medium text-ck-ink outline-none transition-colors duration-150 hover:border-ck-muted/60 hover:bg-ck-soft! focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] motion-reduce:transition-none"
        >
          <CheckoutIcon name="plus" className="size-4" />
          {book.add}
        </button>
      )}
    </div>
  )
}

/** The PIN-first form in a panel: a new address (Cancel), or a saved one being edited (Save). */
function AddressPanel({ ck, heading, editing, children }: AddressPanelProps) {
  return (
    <div className="flex flex-col gap-5 rounded-ck border border-ck-line bg-ck-bg p-4 sm:p-5">
      <h4 className={`${CK_HEADING} text-[0.9375rem]!`}>{heading}</h4>
      {children}
      {ck.addressError ? (
        <p role="alert" className="text-[0.8125rem] text-ck-danger">
          {ck.addressError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={ck.handleCancelAddress}
          disabled={ck.savingAddress}
          className={CK_BUTTON_SECONDARY}
        >
          {book.cancel}
        </button>
        {editing ? (
          <button
            id={SAVE_ADDRESS_ID}
            type="button"
            onClick={ck.handleSaveAddress}
            disabled={ck.savingAddress}
            aria-busy={ck.savingAddress}
            className={`${CK_BUTTON_PRIMARY} h-11! w-auto!`}
          >
            {ck.savingAddress ? book.saving : book.save}
          </button>
        ) : null}
      </div>
    </div>
  )
}
