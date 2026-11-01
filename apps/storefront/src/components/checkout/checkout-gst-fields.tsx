'use client'

import CheckoutField from '@/components/checkout/checkout-field'
import type { CheckoutCopy } from '@/data/checkout'
import { type CheckoutFieldErrors, fieldId } from '@/lib/checkout-validation'

type GstKey = 'gstin' | 'businessName'

type CheckoutGstFieldsProps = {
  values: Record<GstKey, string>
  errors: CheckoutFieldErrors
  /** The shopper ticked the box; the parent clears the fields when they untick it. */
  business: boolean
  /** The company name is asked for in Delivery (#154): only the GSTIN is asked for here. */
  companyShown: boolean
  /** The checkout's words, with the store's own wording over ours (#158). */
  copy: CheckoutCopy
  onBusiness: (on: boolean) => void
  onField: (key: GstKey) => (e: React.ChangeEvent<HTMLInputElement>) => void
  onLeave: (key: 'gstin') => void
}

/**
 * "Get a GST invoice for my business" at the foot of the Payment card (design), opening onto
 * GSTIN and business name. The fields slide in from just above (200ms ease-out, opacity and
 * a 4px rise; a fade only with reduced motion).
 */
export default function CheckoutGstFields({
  values,
  errors,
  business,
  companyShown,
  copy,
  onBusiness,
  onField,
  onLeave,
}: CheckoutGstFieldsProps) {
  // Render logic
  const f = copy.fields

  return (
    <div className="flex flex-col gap-3 pt-1">
      <label className="flex w-fit cursor-pointer items-center gap-2 text-[0.8125rem] text-ck-ink/85">
        <input
          type="checkbox"
          checked={business}
          onChange={(e) => onBusiness(e.target.checked)}
          className="size-4 cursor-pointer rounded accent-[var(--ck-accent)]"
        />
        {copy.business}
      </label>
      {business ? (
        <div className="grid gap-3 transition-[opacity,translate] duration-200 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0 sm:grid-cols-2">
          <CheckoutField
            id={fieldId('gstin')}
            label={f.gstin}
            autoComplete="off"
            maxLength={15}
            placeholder={f.gstinPlaceholder}
            value={values.gstin}
            onChange={onField('gstin')}
            onBlur={() => onLeave('gstin')}
            error={errors.gstin}
            hint={f.gstinHint}
          />
          {companyShown ? null : (
            <CheckoutField
              id="checkout-business-name"
              label={f.businessName}
              autoComplete="organization"
              value={values.businessName}
              onChange={onField('businessName')}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}
