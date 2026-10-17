'use client'

import PhoneInput from '@commerce/blocks/phone-input-lazy'
import type { SignedInCustomer } from '@commerce/core'
import { useState, useTransition } from 'react'
import { accountContent } from '@/data/account'
import { saveProfileAction } from '@/lib/account-actions'

type ProfileFormProps = { customer: SignedInCustomer }

const copy = accountContent.profile

/** Name, mobile and marketing consent; the email is shown but fixed. */
export default function ProfileForm({ customer }: ProfileFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [name, setName] = useState(customer.name ?? '')
  const [phone, setPhone] = useState(customer.phone ?? '')
  const [marketing, setMarketing] = useState(customer.acceptsMarketing)
  const [whatsapp, setWhatsapp] = useState(customer.acceptsWhatsapp)
  const [sms, setSms] = useState(customer.acceptsSms)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  // Event handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(false)
    start(async () => {
      const r = await saveProfileAction({
        name,
        phone,
        acceptsMarketing: marketing,
        acceptsWhatsapp: whatsapp,
        acceptsSms: sms,
      })
      if (r.ok) {
        setErrors({})
        setSaved(true)
      } else setErrors(r.errors)
    })
  }

  // Render logic
  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-[36rem] flex-col gap-5 rounded-[var(--radius-card)] bg-surface p-6"
    >
      <h2 className="h3">{copy.title}</h2>
      <div className="field">
        <span className="field__label text-small">{copy.email}</span>
        {customer.email ? (
          <>
            <p className="text-body">{customer.email}</p>
            <span className="text-small text-muted">{copy.emailNote}</span>
          </>
        ) : (
          <span className="text-small text-muted">{copy.emailNone}</span>
        )}
      </div>
      <label className="field">
        <span className="field__label text-small">{copy.name}</span>
        <input
          className="field__input"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {errors.name ? <span className="text-small text-danger">{errors.name}</span> : null}
      </label>
      <div className="field">
        <label htmlFor="profile-phone" className="field__label text-small">
          {copy.phone}
        </label>
        <PhoneInput
          id="profile-phone"
          countries={['IN']}
          autoComplete="tel"
          value={phone}
          onChange={setPhone}
          aria-invalid={errors.phone ? true : undefined}
        />
        {errors.phone ? <span className="text-small text-danger">{errors.phone}</span> : null}
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="field__label text-small">{copy.marketingHeading}</legend>
        {[
          { id: 'email', label: copy.marketing, checked: marketing, set: setMarketing },
          { id: 'whatsapp', label: copy.marketingWhatsapp, checked: whatsapp, set: setWhatsapp },
          { id: 'sms', label: copy.marketingSms, checked: sms, set: setSms },
        ].map((c) => (
          <label key={c.id} className="flex items-center gap-3 text-body">
            <input
              type="checkbox"
              className="size-4"
              checked={c.checked}
              onChange={(e) => c.set(e.target.checked)}
            />
            {c.label}
          </label>
        ))}
        <span className="text-small text-muted">{copy.marketingNote}</span>
      </fieldset>
      <div className="flex items-center gap-4">
        <button
          type="submit"
          className={`btn btn--primary${pending ? ' is-loading' : ''}`}
          disabled={pending}
        >
          <span className="btn__label">{pending ? copy.saving : copy.save}</span>
        </button>
        {saved ? (
          <span className="text-small text-success" role="status">
            {copy.saved}
          </span>
        ) : null}
      </div>
    </form>
  )
}
