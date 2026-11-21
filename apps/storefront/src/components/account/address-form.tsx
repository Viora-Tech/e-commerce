'use client'

import type { SavedAddress } from '@commerce/core'
import { isPincode } from '@commerce/core/account-patterns'
import { useState, useTransition } from 'react'
import CheckoutField from '@/components/checkout/checkout-field'
import CheckoutSelect from '@/components/checkout/checkout-select'
import CheckoutToggle from '@/components/checkout/checkout-toggle'
import { accountContent } from '@/data/account'
import { INDIAN_STATES } from '@/data/indian-states'
import { saveAddressAction } from '@/lib/account-actions'
import { ACCOUNT_CARD_TITLE, ACCOUNT_ERROR, ACCOUNT_TOGGLES } from '@/lib/account-classes'
import { CK_BUTTON_SECONDARY, CK_LIFT, CK_PANEL } from '@/lib/checkout-classes'
import AccountSubmit from './account-submit'

type AddressFormProps = {
  /** The address being edited; null adds a new one. */
  address: SavedAddress | null
  /** Pre-ticks "default" (first address, or none saved yet). */
  defaultChecked: boolean
  onDone: () => void
}

const copy = accountContent.addresses
const f = copy.fields

type Values = {
  name: string
  phone: string
  line1: string
  line2: string
  city: string
  stateCode: string
  pincode: string
  isDefault: boolean
}

type TextKey = Exclude<keyof Values, 'isDefault' | 'stateCode'>

const STATE_OPTIONS: readonly (readonly [string, string])[] = [['', f.state], ...INDIAN_STATES]

/**
 * What the form can tell before the server does: a PIN code that is not six digits, or no
 * state picked (the select's blank first row). Null when both are fine.
 */
export function checkAddress(
  v: Pick<Values, 'pincode' | 'stateCode'>,
): Record<string, string> | null {
  const errors: Record<string, string> = {}
  if (!isPincode(v.pincode)) errors.pincode = copy.pincodeHint
  if (!v.stateCode) errors.stateCode = copy.stateRequired
  return Object.keys(errors).length > 0 ? errors : null
}

const initial = (a: SavedAddress | null, isDefault: boolean): Values => ({
  name: a?.name ?? '',
  phone: a?.phone ?? '',
  line1: a?.line1 ?? '',
  line2: a?.line2 ?? '',
  city: a?.city ?? '',
  stateCode: a?.stateCode ?? '',
  pincode: a?.pincode ?? '',
  isDefault: a?.isDefault ?? isDefault,
})

/**
 * Add or edit one address, drawn as the checkout's address panel (CheckoutField,
 * CheckoutSelect); errors come back per field from the server. The PIN code is checked here
 * first so a typo does not wait for a round trip.
 */
export default function AddressForm({ address, defaultChecked, onDone }: AddressFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [values, setValues] = useState<Values>(() => initial(address, defaultChecked))
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Helpers
  const setText = (k: TextKey) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [k]: e.target.value }))

  // Event handlers
  const handleState = (stateCode: string) => setValues((prev) => ({ ...prev, stateCode }))

  const handleDefault = (isDefault: boolean) => setValues((prev) => ({ ...prev, isDefault }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const local = checkAddress(values)
    if (local) {
      setErrors(local)
      return
    }
    setErrors({})
    start(async () => {
      const r = await saveAddressAction(address?.id ?? null, values)
      if (r.ok) onDone()
      else setErrors(r.errors)
    })
  }

  // Render logic
  const idPrefix = `address-${address?.id ?? 'new'}`

  return (
    <form
      onSubmit={handleSubmit}
      className={`${CK_PANEL} ${CK_LIFT} flex flex-col gap-4 p-5 sm:p-6`}
      aria-labelledby={`${idPrefix}-title`}
    >
      <h2 id={`${idPrefix}-title`} className={ACCOUNT_CARD_TITLE}>
        {address ? copy.formEdit : copy.formAdd}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <CheckoutField
          id={`${idPrefix}-name`}
          label={f.name}
          value={values.name}
          onChange={setText('name')}
          error={errors.name}
          required
          autoComplete="name"
        />
        <CheckoutField
          id={`${idPrefix}-phone`}
          label={f.phone}
          value={values.phone}
          onChange={setText('phone')}
          error={errors.phone}
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
        />
      </div>
      <CheckoutField
        id={`${idPrefix}-line1`}
        label={f.line1}
        value={values.line1}
        onChange={setText('line1')}
        error={errors.line1}
        required
        autoComplete="address-line1"
      />
      <CheckoutField
        id={`${idPrefix}-line2`}
        label={f.line2}
        value={values.line2}
        onChange={setText('line2')}
        error={errors.line2}
        autoComplete="address-line2"
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <CheckoutField
          id={`${idPrefix}-pincode`}
          label={f.pincode}
          value={values.pincode}
          onChange={setText('pincode')}
          error={errors.pincode}
          required
          inputMode="numeric"
          maxLength={6}
          autoComplete="postal-code"
        />
        <CheckoutField
          id={`${idPrefix}-city`}
          label={f.city}
          value={values.city}
          onChange={setText('city')}
          error={errors.city}
          required
          autoComplete="address-level2"
        />
        <div className="col-span-2 md:col-span-1">
          <CheckoutSelect
            id={`${idPrefix}-state`}
            label={f.state}
            value={values.stateCode}
            options={STATE_OPTIONS}
            onChange={handleState}
            error={errors.stateCode}
            required
            autoComplete="address-level1"
          />
        </div>
      </div>
      {address?.isDefault ? null : (
        <div className={ACCOUNT_TOGGLES}>
          <CheckoutToggle
            label={copy.setDefault}
            checked={values.isDefault}
            onChange={handleDefault}
          />
        </div>
      )}
      {errors.form ? (
        <p className={ACCOUNT_ERROR} role="alert">
          {errors.form}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          className={`${CK_BUTTON_SECONDARY} h-13! w-full sm:w-auto`}
          onClick={onDone}
          disabled={pending}
        >
          {copy.cancel}
        </button>
        <div className="sm:ms-auto sm:min-w-[12rem]">
          <AccountSubmit label={copy.save} pendingLabel={copy.saving} pending={pending} />
        </div>
      </div>
    </form>
  )
}
