'use client'

import { ADDRESS_LABELS } from '@commerce/core/accounts'
import { useRef, useState, useTransition } from 'react'
import CheckoutField from '@/components/checkout/checkout-field'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import CheckoutSelect from '@/components/checkout/checkout-select'
import { checkoutContent as content, INDIAN_STATES } from '@/data/checkout'
import { CK_LABEL } from '@/lib/checkout-classes'
import { type CheckoutFieldErrors, cleanPincode, fieldId } from '@/lib/checkout-validation'
import { lookupPincodeAction, type PincodePlaceView } from '@/lib/pincode-actions'

type AddressKey = 'name' | 'line1' | 'line2' | 'city' | 'gstin' | 'businessName'
type LeaveKey = 'name' | 'line1' | 'city' | 'pincode' | 'stateCode' | 'gstin'

type CheckoutAddressFieldsProps = {
  values: Record<AddressKey | 'stateCode' | 'pincode' | 'label', string>
  errors: CheckoutFieldErrors
  digitalOnly: boolean
  /** Settings → Checkout: business buyers can add a GSTIN. */
  gstinEnabled: boolean
  /** The shopper ticked "Add a GSTIN"; the parent clears the fields when they untick it. */
  business: boolean
  /** The courier's promise under the PIN code; why it cannot deliver shows in Delivery method. */
  deliveryText: string | null
  checking: boolean
  /** Signed-in shoppers tag the address Home, Office or Other for their address book. */
  onLabel?: ((label: string) => void) | null
  onField: (key: AddressKey) => (e: React.ChangeEvent<HTMLInputElement>) => void
  onLeave: (key: LeaveKey) => void
  onPincode: (pincode: string) => void
  onState: (stateCode: string) => void
  onBusiness: (on: boolean) => void
  /** City and state found for the PIN code; the shopper can still change both. */
  onPlace: (place: PincodePlaceView, pincode: string) => void
}

const f = content.fields
const tags = content.addressBook.tags
const isFullPincode = (v: string) => /^[1-9]\d{5}$/.test(cleanPincode(v))
const stateName = (code: string) => INDIAN_STATES.find(([c]) => c === code)?.[1] ?? code

/**
 * The delivery address, PIN code first: six digits fill in the city and state (still
 * editable) and the courier's answer shows right under it, before anything else is typed.
 * The GSTIN for a business invoice is optional, behind its own box. Saved addresses are
 * cards around this form (`checkout-address-book.tsx`).
 */
export default function CheckoutAddressFields({
  values,
  errors,
  digitalOnly,
  gstinEnabled,
  business,
  deliveryText,
  checking,
  onLabel = null,
  onField,
  onLeave,
  onPincode,
  onState,
  onBusiness,
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
    if (digitalOnly || !isFullPincode(pincode)) return
    startFind(async () => {
      const place = await lookupPincodeAction(cleanPincode(pincode))
      // A slower answer for a PIN code the shopper has since changed is dropped.
      if (!place || latest.current !== pincode) return
      setFound(content.pincodeFirst.found(place.city, stateName(place.stateCode)))
      onPlace(place, pincode)
    })
  }

  // Render logic
  const busy = finding || checking
  const status = errors.pincode
    ? null
    : finding
      ? content.pincodeFirst.finding
      : (deliveryText ?? found)
  const pincodeField = (
    <div className="flex flex-col gap-2">
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
      {status && !digitalOnly ? (
        <p role="status" className="flex items-center gap-2 text-[0.8125rem] text-ck-muted">
          <CheckoutIcon name="truck" className="size-4" />
          {status}
        </p>
      ) : null}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {digitalOnly ? (
        <p className="text-[0.875rem] text-ck-muted">{content.giftCardDelivery}</p>
      ) : null}
      {pincodeField}
      <CheckoutField
        id={fieldId('name')}
        label={f.name}
        required
        autoComplete="name"
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
      <CheckoutField
        id="checkout-line2"
        label={f.line2}
        autoComplete="address-line2"
        value={values.line2}
        onChange={onField('line2')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <CheckoutField
          id={fieldId('city')}
          label={f.city}
          required
          autoComplete="address-level2"
          value={values.city}
          onChange={onField('city')}
          onBlur={() => onLeave('city')}
          error={errors.city}
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
        />
      </div>
      {onLabel && !digitalOnly ? (
        <fieldset className="flex flex-col gap-2 border-0! p-0!">
          <legend className={`${CK_LABEL} mb-2!`}>{content.addressBook.tagLegend}</legend>
          <div className="flex flex-wrap gap-2">
            {ADDRESS_LABELS.map((tag) => (
              <label
                key={tag}
                className="cursor-pointer rounded-full border border-ck-line bg-ck-field px-3.5 py-1.5 text-[0.8125rem] font-medium text-ck-ink transition-[border-color,background-color] duration-150 hover:border-ck-muted/50 has-[:checked]:border-ck-accent has-[:checked]:bg-ck-accent-soft has-[:focus-visible]:[box-shadow:0_0_0_3px_var(--ck-ring)] motion-reduce:transition-none"
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
      {gstinEnabled ? (
        <div className="flex flex-col gap-4">
          <label className="flex w-fit cursor-pointer items-center gap-3 text-[0.875rem] text-ck-ink">
            <input
              type="checkbox"
              checked={business}
              onChange={(e) => onBusiness(e.target.checked)}
              className="size-[1.125rem] cursor-pointer rounded accent-[var(--ck-accent)]"
            />
            {content.business}
          </label>
          {business ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <CheckoutField
                id={fieldId('gstin')}
                label={f.gstin}
                autoComplete="off"
                maxLength={15}
                value={values.gstin}
                onChange={onField('gstin')}
                onBlur={() => onLeave('gstin')}
                error={errors.gstin}
                hint={f.gstinHint}
              />
              <CheckoutField
                id="checkout-business-name"
                label={f.businessName}
                autoComplete="organization"
                value={values.businessName}
                onChange={onField('businessName')}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
