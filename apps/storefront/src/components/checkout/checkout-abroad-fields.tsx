'use client'

import { postalCodeRequired, regionList, regionRequired } from '@commerce/core/checkout-address'
import type { CheckoutFields } from '@commerce/core/checkout-settings'
import CheckoutField from '@/components/checkout/checkout-field'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import CheckoutNameFields from '@/components/checkout/checkout-name-fields'
import CheckoutSelect from '@/components/checkout/checkout-select'
import { type CheckoutCopy, checkoutContent as content } from '@/data/checkout'
import { countryName } from '@/lib/checkout-countries'
import { type CheckoutFieldErrors, fieldId } from '@/lib/checkout-validation'

type AddressKey = 'name' | 'lastName' | 'businessName' | 'line1' | 'line2' | 'city'
type LeaveKey = AddressKey | 'pincode' | 'stateCode'

type CheckoutAbroadFieldsProps = {
  values: Record<Exclude<AddressKey, 'lastName'> | 'stateCode' | 'pincode', string> & {
    lastName?: string | undefined
    countryCode: string
  }
  errors: CheckoutFieldErrors
  /** Settings → Checkout → Form fields (#154): name format, company name, address line 2. */
  fields: CheckoutFields
  copy: CheckoutCopy
  checking: boolean
  /** Nothing covers this country (shown in Shipping too), or null. */
  unserviceable: string | null
  onField: (key: AddressKey) => (e: React.ChangeEvent<HTMLInputElement>) => void
  onLeave: (key: LeaveKey) => void
  onPostcode: (postcode: string) => void
  onRegion: (region: string) => void
}

const abroad = content.abroad

/**
 * The Delivery card's fields for an address outside India: name, street, apartment, then
 * city, region and postcode as the country writes them. No PIN code lookup or courier check:
 * the country's shipping zone prices it, and a line under the fields says where it ships.
 */
export default function CheckoutAbroadFields({
  values,
  errors,
  fields,
  copy,
  checking,
  unserviceable,
  onField,
  onLeave,
  onPostcode,
  onRegion,
}: CheckoutAbroadFieldsProps) {
  // Render logic
  const f = copy.fields
  const line2Required = fields.line2 === 'required'
  const postcodeRequired = postalCodeRequired(values.countryCode)
  const regionNeeded = regionRequired(values.countryCode)
  // US states, Canadian provinces, Australian states: a list, so couriers get the code.
  const regions = regionList(values.countryCode)
  const regionLabel = regionNeeded ? abroad.region : abroad.regionOptional
  const status = checking
    ? { text: content.delivery.checking, bad: false }
    : unserviceable
      ? { text: unserviceable, bad: true }
      : { text: abroad.shipsTo(countryName(values.countryCode)), bad: false }

  return (
    <div className="flex flex-col gap-3 sm:gap-3.5">
      <CheckoutNameFields
        values={values}
        errors={errors}
        fields={fields}
        copy={copy}
        onField={onField}
        onLeave={onLeave}
      />
      <CheckoutField
        id={fieldId('line1')}
        label={abroad.line1}
        required
        autoComplete="address-line1"
        placeholder={abroad.line1Placeholder}
        value={values.line1}
        onChange={onField('line1')}
        onBlur={() => onLeave('line1')}
        error={errors.line1}
      />
      {fields.line2 === 'hidden' ? null : (
        <CheckoutField
          id={fieldId('line2')}
          label={line2Required ? abroad.line2Required : abroad.line2}
          required={line2Required}
          autoComplete="address-line2"
          placeholder={abroad.line2Placeholder}
          value={values.line2}
          onChange={onField('line2')}
          onBlur={() => onLeave('line2')}
          error={errors.line2}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-3">
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
        {regions ? (
          <CheckoutSelect
            id={fieldId('stateCode')}
            label={regionLabel}
            value={values.stateCode}
            options={[['', abroad.regionPick], ...regions]}
            autoComplete="address-level1"
            onChange={onRegion}
            onBlur={() => onLeave('stateCode')}
            error={errors.stateCode}
          />
        ) : (
          <CheckoutField
            id={fieldId('stateCode')}
            label={regionLabel}
            required={regionNeeded}
            autoComplete="address-level1"
            maxLength={80}
            value={values.stateCode}
            onChange={(e) => onRegion(e.target.value)}
            onBlur={() => onLeave('stateCode')}
            error={errors.stateCode}
          />
        )}
        <CheckoutField
          id={fieldId('pincode')}
          label={postcodeRequired ? abroad.postcode : abroad.postcodeOptional}
          required={postcodeRequired}
          autoComplete="postal-code"
          maxLength={12}
          value={values.pincode}
          onChange={(e) => onPostcode(e.target.value)}
          onBlur={() => onLeave('pincode')}
          error={errors.pincode}
        />
      </div>
      <p
        aria-live="polite"
        className={`flex items-center gap-1.5 text-[0.75rem] font-medium sm:text-[0.8125rem] ${status.bad ? 'text-ck-danger' : 'text-ck-muted'}`}
      >
        <CheckoutIcon
          name={status.bad ? 'alert' : 'truck'}
          className="size-3.5 shrink-0 sm:size-4"
        />
        {status.text}
      </p>
    </div>
  )
}
