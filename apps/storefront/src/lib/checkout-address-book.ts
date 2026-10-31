import type { SavedAddress } from '@commerce/core'
import type { TransitionStartFunction } from 'react'
import { checkoutContent as content } from '@/data/checkout'
import { deleteAddressAction, saveAddressAction } from '@/lib/account-actions'
import { ADDRESS_KEYS } from '@/lib/checkout-form-input'
import { type CheckoutFormState, fullNameOf, NEW_ADDRESS } from '@/lib/checkout-form-state'
import { type checkoutFieldErrors, cleanPincode, fieldId } from '@/lib/checkout-validation'

/** What the checkout's address book handlers read and change in `useCheckoutForm`. */
type AddressBookState = {
  addresses: SavedAddress[]
  /** The saved address being edited in place, or null. */
  editingId: string | null
  setEditingId: (id: string | null) => void
  savedId: string
  form: CheckoutFormState
  fieldErrors: ReturnType<typeof checkoutFieldErrors>
  setAttempted: (on: boolean) => void
  setAddressError: (error: string | null) => void
  startSave: TransitionStartFunction
  /** Pick a saved address (or the new address form) as the delivery address. */
  pickAddress: (id: string) => void
  refresh: () => void
}

/** The checkout's address book: edit a saved address in place, save it, delete it, or leave the edit. */
export function addressBookHandlers(d: AddressBookState) {
  /** Edit a saved address in place: its values fill the fields, Save writes the address book. */
  const handleEdit = (id: string) => {
    d.pickAddress(id)
    d.setEditingId(id)
  }
  /** Leave the edit (or the new address form) and go back to a saved address. */
  const handleCancelAddress = () => {
    const back = d.addresses.find((a) => a.id === d.editingId) ?? d.addresses[0]
    if (back) d.pickAddress(back.id)
    else d.setEditingId(null)
  }
  const handleSaveAddress = () => {
    if (!d.editingId) return
    const wrong = ADDRESS_KEYS.find((k) => d.fieldErrors[k])
    if (wrong) {
      d.setAttempted(true)
      document.getElementById(fieldId(wrong))?.focus()
      return
    }
    d.setAddressError(null)
    const id = d.editingId
    d.startSave(async () => {
      const r = await saveAddressAction(id, {
        name: fullNameOf(d.form),
        line1: d.form.line1,
        line2: d.form.line2,
        city: d.form.city,
        stateCode: d.form.stateCode,
        pincode: cleanPincode(d.form.pincode),
        phone: d.form.phone,
        label: d.form.label || null,
      })
      if (!r.ok) {
        d.setAddressError(content.addressBook.saveFailed)
        return
      }
      d.setEditingId(null)
      d.refresh()
    })
  }
  const handleDeleteAddress = (id: string) => {
    d.startSave(async () => {
      await deleteAddressAction(id)
      if (d.savedId === id) d.pickAddress(d.addresses.find((a) => a.id !== id)?.id ?? NEW_ADDRESS)
      d.refresh()
    })
  }
  return { handleEdit, handleCancelAddress, handleSaveAddress, handleDeleteAddress }
}
