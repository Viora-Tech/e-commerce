'use client'

import type { CheckoutFields } from '@commerce/core/checkout-settings'
import CheckoutField from '@/components/checkout/checkout-field'
import type { CheckoutCopy } from '@/data/checkout'
import { type CheckoutFieldErrors, fieldId } from '@/lib/checkout-validation'

type NameKey = 'name' | 'lastName' | 'businessName'

type CheckoutNameFieldsProps = {
  values: { name: string; lastName?: string | undefined; businessName: string }
  errors: CheckoutFieldErrors
  /** Settings → Checkout → Form fields (#154). */
  fields: CheckoutFields
  /** The checkout's words, with the store's own wording over ours (#158). */
  copy: CheckoutCopy
  onField: (key: NameKey) => (e: React.ChangeEvent<HTMLInputElement>) => void
  onLeave: (key: NameKey) => void
}

/**
 * Who the parcel is for: one full name, or first and last name side by side, then the company
 * name when the store asks for it (optional or required; GST buyers fill it in).
 */
export default function CheckoutNameFields({
  values,
  errors,
  fields,
  copy,
  onField,
  onLeave,
}: CheckoutNameFieldsProps) {
  // Render logic
  const f = copy.fields
  const split = fields.name === 'split'

  return (
    <>
      {split ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <CheckoutField
            id={fieldId('name')}
            label={f.firstName}
            required
            autoComplete="given-name"
            value={values.name}
            onChange={onField('name')}
            onBlur={() => onLeave('name')}
            error={errors.name}
          />
          <CheckoutField
            id={fieldId('lastName')}
            label={f.lastName}
            required
            autoComplete="family-name"
            value={values.lastName ?? ''}
            onChange={onField('lastName')}
            onBlur={() => onLeave('lastName')}
            error={errors.lastName}
          />
        </div>
      ) : (
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
      )}
      {fields.company === 'hidden' ? null : (
        <CheckoutField
          id={fieldId('businessName')}
          label={fields.company === 'required' ? f.company : f.companyOptional}
          required={fields.company === 'required'}
          autoComplete="organization"
          value={values.businessName}
          onChange={onField('businessName')}
          onBlur={() => onLeave('businessName')}
          error={errors.businessName}
        />
      )}
    </>
  )
}
