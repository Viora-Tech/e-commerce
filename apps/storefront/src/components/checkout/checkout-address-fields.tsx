'use client'

import { ADDRESS_LABELS } from '@commerce/core/accounts'
import { useRef, useState, useTransition } from 'react'
import CheckoutField from '@/components/checkout/checkout-field'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import CheckoutSelect from '@/components/checkout/checkout-select'
import { checkoutContent as content } from '@/data/checkout'
import { INDIAN_STATES } from '@/data/indian-states'
import { CK_LABEL } from '@/lib/checkout-classes'
import { type CheckoutFieldErrors, cleanPincode, fieldId } from '@/lib/checkout-validation'
import { lookupPincodeAction, type PincodePlaceView } from '@/lib/pincode-actions'

type AddressKey = 'name' | 'line1' | 'line2' | 'city'
type LeaveKey = 'name' | 'line1' | 'city' | 'pincode' | 'stateCode'

type CheckoutAddressFieldsProps = {
  values: Record<AddressKey | 'stateCode' | 'pincode' | 'label', string>
  errors: CheckoutFieldErrors
  digitalOnly: boolean
  /** "Thu, 29 Oct": when the picked option arrives at this PIN code; null until quoted. */
  deliveryBy: string | null
  /** Why the courier cannot deliver here (shown in Shipping too), or null. */
  unserviceable: string | null
  checking: boolean
  /** Signed-in shoppers tag the address Home, Office or Other for their address book. */
  onLabel?: ((label: string) => void) | null
  onField: (key: AddressKey) => (e: React.ChangeEvent<HTMLInputElement>) => void
  onLeave: (key: LeaveKey) => void
  onPincode: (pincode: string) => void
  onState: (stateCode: string) => void
  /** City and state found for the PIN code; the shopper can still change both. */
  onPlace: (place: PincodePlaceView, pincode: string) => void
}

const f = content.fields
const tags = content.addressBook.tags
const isFullPincode = (v: string) => /^[1-9]\d{5}$/.test(cleanPincode(v))
const stateName = (code: string) => INDIAN_STATES.find(([c]) => c === code)?.[1] ?? code

/**
 * The Delivery card's fields, PIN code first (design): six digits fill in the city and state
 * (still editable, soft grey with a brief highlight as they land) and a green line beside the
 * PIN code says where and by when ("Gurugram, Haryana · by Thu, 29 Oct"), rising in over
 * 200ms. Then the name, the street and the landmark. Saved addresses are cards around this
 * form (`checkout-address-book.tsx`).
 */
export default function CheckoutAddressFields({
  values,
  errors,
  digitalOnly,
  deliveryBy,
  unserviceable,
  checking,
  onLabel = null,
  onField,
  onLeave,
  onPincode,
  onState,
  onPlace,
}: CheckoutAddressFieldsProps) {
  // Hooks
  const [finding, startFind] = useTransition()
  /** The PIN code the city and state were filled in for, so the highlight follows it. */
  const [filledFor, setFilledFor] = useState<string | null>(null)
  const latest = useRef('')

  // Event handlers
  const handlePincode = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pincode = e.target.value
    latest.current = pincode
    setFilledFor(null)
    onPincode(pincode)
    if (digitalOnly || !isFullPincode(pincode)) return
    startFind(async () => {
      const place = await lookupPincodeAction(cleanPincode(pincode))
      // A slower answer for a PIN code the shopper has since changed is dropped.
      if (!place || latest.current !== pincode) return
      setFilledFor(cleanPincode(pincode))
      onPlace(place, pincode)
    })
  }

  // Render logic
  const busy = finding || checking
  const full = isFullPincode(values.pincode)
  const filled = filledFor !== null && filledFor === cleanPincode(values.pincode)
  const place =
    full && values.city.trim() && values.stateCode
      ? { city: values.city.trim(), state: stateName(values.stateCode) }
      : null
  const status: { text: string; tone: 'ok' | 'busy' | 'bad' } | null =
    digitalOnly || errors.pincode || !full
      ? null
      : busy
        ? { text: content.pincodeFirst.finding, tone: 'busy' }
        : unserviceable
          ? { text: unserviceable, tone: 'bad' }
          : place
            ? {
                text: deliveryBy
                  ? content.pincodeFirst.foundBy(place.city, place.state, deliveryBy)
                  : content.pincodeFirst.found(place.city, place.state),
                tone: 'ok',
              }
            : null

  return (
    <div className="flex flex-col gap-3 sm:gap-3.5">
      {digitalOnly ? (
        <p className="text-[0.8125rem] text-ck-muted">{content.giftCardDelivery}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
        <CheckoutField
          id={fieldId('pincode')}
          label={f.pincode}
          required
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={7}
          placeholder={f.pincodePlaceholder}
          value={values.pincode}
          onChange={handlePincode}
          onBlur={() => onLeave('pincode')}
          error={errors.pincode}
          trailing={
            busy ? (
              <CheckoutIcon
                name="spinner"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
            ) : null
          }
        />
        <div
          aria-live="polite"
          className="-mt-1 empty:hidden sm:mt-0 sm:flex sm:h-11 sm:items-center"
        >
          {status ? (
            <p
              key={status.text}
              className={`flex items-center gap-1.5 text-[0.75rem] font-medium transition-[opacity,translate] duration-200 ease-out starting:translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0 sm:text-[0.8125rem] ${status.tone === 'ok' ? 'text-ck-success' : status.tone === 'bad' ? 'text-ck-danger' : 'text-ck-muted'}`}
            >
              <CheckoutIcon
                name={status.tone === 'ok' ? 'check' : status.tone === 'bad' ? 'alert' : 'truck'}
                className="size-3.5 shrink-0 sm:size-4"
              />
              {status.text}
            </p>
          ) : null}
        </div>
      </div>
      <CheckoutField
        id={fieldId('name')}
        label={f.name}
        required
        autoComplete="name"
        placeholder={f.namePlaceholder}
        value={values.name}
        onChange={onField('name')}
        onBlur={() => onLeave('name')}
        error={errors.name}
      />
      <CheckoutField
        id={fieldId('line1')}
        label={f.line1}
        required
        autoComplete="address-line1"
        placeholder={f.line1Placeholder}
        value={values.line1}
        onChange={onField('line1')}
        onBlur={() => onLeave('line1')}
        error={errors.line1}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <div className="col-span-2 sm:col-span-1">
          <CheckoutField
            id="checkout-line2"
            label={f.line2}
            autoComplete="address-line2"
            placeholder={f.line2Placeholder}
            value={values.line2}
            onChange={onField('line2')}
          />
        </div>
        <CheckoutField
          id={fieldId('city')}
          label={f.city}
          required
          autoComplete="address-level2"
          value={values.city}
          onChange={onField('city')}
          onBlur={() => onLeave('city')}
          error={errors.city}
          filled={filled}
        />
        <CheckoutSelect
          id={fieldId('stateCode')}
          label={f.state}
          value={values.stateCode}
          options={INDIAN_STATES}
          autoComplete="address-level1"
          onChange={onState}
          onBlur={() => onLeave('stateCode')}
          error={errors.stateCode}
          filled={filled}
        />
      </div>
      {onLabel && !digitalOnly ? (
        <fieldset className="flex flex-col gap-2 border-0! p-0!">
          <legend className={`${CK_LABEL} mb-2!`}>{content.addressBook.tagLegend}</legend>
          <div className="flex flex-wrap gap-2">
            {ADDRESS_LABELS.map((tag) => (
              <label
                key={tag}
                className="cursor-pointer rounded-full border border-ck-line bg-ck-field px-3.5 py-1.5 text-[0.8125rem] font-medium text-ck-ink transition-[border-color,background-color] duration-150 ease-out hover:border-ck-muted/50 has-[:checked]:border-ck-accent has-[:checked]:bg-ck-accent-soft has-[:focus-visible]:[box-shadow:0_0_0_3px_var(--ck-ring)] motion-reduce:transition-none"
              >
                <input
                  type="radio"
                  name="checkout-address-label"
                  value={tag}
                  checked={values.label === tag}
                  onChange={() => onLabel(tag)}
                  className="sr-only"
                />
                {tags[tag]}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  )
}
