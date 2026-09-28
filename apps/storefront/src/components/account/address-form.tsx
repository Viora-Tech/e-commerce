'use client'

import type { SavedAddress } from '@commerce/core'
import { isPincode } from '@commerce/core/account-patterns'
import { useState, useTransition } from 'react'
import { accountContent } from '@/data/account'
import { INDIAN_STATES } from '@/data/checkout'
import { saveAddressAction } from '@/lib/account-actions'

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

/** Add or edit one address; errors come back per field from the server. */
export default function AddressForm({ address, defaultChecked, onDone }: AddressFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [values, setValues] = useState<Values>(() => initial(address, defaultChecked))
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Helpers
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((prev) => ({
      ...prev,
      [k]:
        e.target instanceof HTMLInputElement && e.target.type === 'checkbox'
          ? e.target.checked
          : e.target.value,
    }))

  const field = (
    k: Exclude<keyof Values, 'isDefault' | 'stateCode'>,
    label: string,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label className="field">
      <span className="field__label text-small">{label}</span>
      <input
        className="field__input"
        value={values[k]}
        onChange={set(k)}
        aria-invalid={errors[k] ? true : undefined}
        {...extra}
      />
      {errors[k] ? <span className="text-small text-danger">{errors[k]}</span> : null}
    </label>
  )

  // Event handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isPincode(values.pincode)) {
      setErrors({ pincode: copy.pincodeHint })
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
  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-line p-6"
    >
      <h3 className="h4">{address ? copy.formEdit : copy.formAdd}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {field('name', f.name, { required: true, autoComplete: 'name' })}
        {field('phone', f.phone, {
          required: true,
          type: 'tel',
          inputMode: 'tel',
          autoComplete: 'tel',
        })}
      </div>
      {field('line1', f.line1, { required: true, autoComplete: 'address-line1' })}
      {field('line2', f.line2, { autoComplete: 'address-line2' })}
      <div className="grid gap-4 md:grid-cols-3">
        {field('city', f.city, { required: true, autoComplete: 'address-level2' })}
        <label className="field">
          <span className="field__label text-small">{f.state}</span>
          <select
            className="field__input"
            value={values.stateCode}
            onChange={set('stateCode')}
            required
            autoComplete="address-level1"
          >
            <option value="" disabled>
              {f.state}
            </option>
            {INDIAN_STATES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          {errors.stateCode ? (
            <span className="text-small text-danger">{errors.stateCode}</span>
          ) : null}
        </label>
        {field('pincode', f.pincode, {
          required: true,
          inputMode: 'numeric',
          pattern: '[1-9][0-9]{5}',
          maxLength: 6,
          autoComplete: 'postal-code',
          title: copy.pincodeHint,
        })}
      </div>
      {address?.isDefault ? null : (
        <label className="flex items-center gap-3 text-body">
          <input
            type="checkbox"
            checked={values.isDefault}
            onChange={set('isDefault')}
            className="size-4"
          />
          {copy.setDefault}
        </label>
      )}
      {errors.form ? (
        <p className="text-small text-danger" role="alert">
          {errors.form}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className={`btn btn--primary${pending ? ' is-loading' : ''}`}
          disabled={pending}
        >
          <span className="btn__label">{pending ? copy.saving : copy.save}</span>
        </button>
        <button type="button" className="btn btn--secondary" onClick={onDone} disabled={pending}>
          {copy.cancel}
        </button>
      </div>
    </form>
  )
}
