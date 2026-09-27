'use client'

import type { SavedAddress } from '@commerce/core'
import { useRef, useState, useTransition } from 'react'
import CheckoutField from '@/components/checkout/checkout-field'
import { accountContent } from '@/data/account'
import { checkoutContent as content, INDIAN_STATES } from '@/data/checkout'
import { lookupPincodeAction, type PincodePlaceView } from '@/lib/pincode-actions'

type AddressKey = 'line1' | 'line2' | 'city'

type CheckoutAddressFieldsProps = {
  values: { line1: string; line2: string; city: string; stateCode: string; pincode: string }
  digitalOnly: boolean
  /** Settings → Checkout: PIN code first, city and state filled from it. */
  pincodeFirst: boolean
  addresses: SavedAddress[]
  savedId: string
  newAddressId: string
  deliveryText: string | null
  unserviceable: boolean
  onPickAddress: (e: React.ChangeEvent<HTMLSelectElement>) => void
  onField: (key: AddressKey) => (e: React.ChangeEvent<HTMLInputElement>) => void
  onPincode: (pincode: string) => void
  onState: (stateCode: string) => void
  /** City and state found for the PIN code; the shopper can still change both. */
  onPlace: (place: PincodePlaceView, pincode: string) => void
}

const f = content.fields
const accountCopy = accountContent.checkout
const isFullPincode = (v: string) => /^[1-9]\d{5}$/.test(v.replace(/[\s-]/g, ''))
const stateName = (code: string) => INDIAN_STATES.find(([c]) => c === code)?.[1] ?? code
const savedLabel = (a: SavedAddress) => `${a.name}, ${a.line1}, ${a.city} ${a.pincode}`

/** The delivery address. With "PIN code first" on, the PIN code comes first and fills city and state. */
export default function CheckoutAddressFields({
  values,
  digitalOnly,
  pincodeFirst,
  addresses,
  savedId,
  newAddressId,
  deliveryText,
  unserviceable,
  onPickAddress,
  onField,
  onPincode,
  onState,
  onPlace,
}: CheckoutAddressFieldsProps) {
  // Hooks
  const [finding, startFind] = useTransition()
  const [found, setFound] = useState<string | null>(null)
  const latest = useRef('')

  // Event handlers
  const handlePincode = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pincode = e.target.value
    latest.current = pincode
    setFound(null)
    onPincode(pincode)
    if (!pincodeFirst || digitalOnly || !isFullPincode(pincode)) return
    startFind(async () => {
      const place = await lookupPincodeAction(pincode)
      // A slower answer for a PIN code the shopper has since changed is dropped.
      if (!place || latest.current !== pincode) return
      setFound(content.pincodeFirst.found(place.city, stateName(place.stateCode)))
      onPlace(place, pincode)
    })
  }

  // Render logic
  const pincodeField = (
    <CheckoutField
      label={f.pincode}
      required
      pattern="[1-9][0-9]{5}"
      autoComplete="postal-code"
      value={values.pincode}
      onChange={handlePincode}
    />
  )
  const hint = finding ? content.pincodeFirst.finding : found

  return (
    <fieldset className="checkout__group">
      <legend className="h4">{digitalOnly ? content.giftCardAddress : content.address}</legend>
      {!digitalOnly && addresses.length > 0 ? (
        <label className="field">
          <span className="field__label text-small">{accountCopy.savedAddresses}</span>
          <select className="field__input" value={savedId} onChange={onPickAddress}>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {savedLabel(a)}
              </option>
            ))}
            <option value={newAddressId}>{accountCopy.newAddress}</option>
          </select>
        </label>
      ) : null}
      {digitalOnly ? (
        <p className="checkout__delivery text-small">{content.giftCardDelivery}</p>
      ) : null}
      {pincodeFirst ? pincodeField : null}
      {pincodeFirst && hint ? <p className="checkout__delivery text-small">{hint}</p> : null}
      <CheckoutField
        label={f.line1}
        required
        autoComplete="address-line1"
        value={values.line1}
        onChange={onField('line1')}
      />
      <CheckoutField
        label={f.line2}
        autoComplete="address-line2"
        value={values.line2}
        onChange={onField('line2')}
      />
      <div className="checkout__row">
        <CheckoutField
          label={f.city}
          required
          autoComplete="address-level2"
          value={values.city}
          onChange={onField('city')}
        />
        <label className="field">
          <span className="field__label text-small">{f.state}</span>
          <select
            className="field__input"
            value={values.stateCode}
            onChange={(e) => onState(e.target.value)}
          >
            {INDIAN_STATES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {pincodeFirst ? null : pincodeField}
      </div>
      {deliveryText ? (
        <p className={`checkout__delivery text-small${unserviceable ? ' is-negative' : ''}`}>
          {deliveryText}
        </p>
      ) : null}
    </fieldset>
  )
}
