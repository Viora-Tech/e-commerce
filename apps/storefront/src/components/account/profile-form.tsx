'use client'

import PhoneInput from '@commerce/blocks/phone-input-lazy'
import type { SignedInCustomer } from '@commerce/core'
import { useState, useTransition } from 'react'
import CheckoutField from '@/components/checkout/checkout-field'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import CheckoutToggle from '@/components/checkout/checkout-toggle'
import { accountContent } from '@/data/account'
import { saveProfileAction } from '@/lib/account-actions'
import {
  ACCOUNT_CARD_TITLE,
  ACCOUNT_ERROR,
  ACCOUNT_INTRO,
  ACCOUNT_TOGGLES,
} from '@/lib/account-classes'
import { CK_INPUT, CK_INPUT_HEIGHT, CK_LABEL, CK_LIFT, CK_PANEL } from '@/lib/checkout-classes'
import AccountSubmit from './account-submit'

type ProfileFormProps = { customer: SignedInCustomer }

const copy = accountContent.profile

const PHONE_ID = 'profile-phone'
const PHONE_INPUT = `${CK_INPUT} ${CK_INPUT_HEIGHT} rounded-s-none!`
const PHONE_TRIGGER = `${CK_INPUT} ${CK_INPUT_HEIGHT} flex! w-auto! gap-1.5 rounded-e-none! border-e-0!`

/**
 * Name, mobile and marketing consent, as the checkout's contact panel: fields in wells, the
 * offers as switches. The email is shown but fixed (it is how they sign in).
 */
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
  const offers = [
    { id: 'email', label: copy.marketing, checked: marketing, set: setMarketing },
    { id: 'whatsapp', label: copy.marketingWhatsapp, checked: whatsapp, set: setWhatsapp },
    { id: 'sms', label: copy.marketingSms, checked: sms, set: setSms },
  ]

  return (
    <form
      onSubmit={handleSubmit}
      className={`${CK_PANEL} ${CK_LIFT} flex max-w-[40rem] flex-col gap-5 p-5 sm:p-6`}
      aria-labelledby="profile-details"
    >
      <h2 id="profile-details" className={ACCOUNT_CARD_TITLE}>
        {copy.detailsTitle}
      </h2>
      <div className="flex flex-col gap-1">
        <span className={CK_LABEL}>{copy.email}</span>
        {customer.email ? (
          <>
            <p className="flex min-h-11 items-center gap-2 break-all text-[0.9375rem] text-ck-ink">
              <CheckoutIcon name="lock" className="size-3.5 shrink-0 text-ck-muted" />
              {customer.email}
            </p>
            <span className="text-[0.8125rem] text-ck-muted">{copy.emailNote}</span>
          </>
        ) : (
          <span className="text-[0.8125rem] text-ck-muted">{copy.emailNone}</span>
        )}
      </div>
      <CheckoutField
        id="profile-name"
        label={copy.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        autoComplete="name"
      />
      <CheckoutField
        id={PHONE_ID}
        label={copy.phone}
        error={errors.phone}
        control={
          <PhoneInput
            id={PHONE_ID}
            countries={['IN']}
            autoComplete="tel"
            value={phone}
            onChange={setPhone}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={errors.phone ? `${PHONE_ID}-error` : undefined}
            className="rounded-ck"
            inputClassName={PHONE_INPUT}
            triggerClassName={PHONE_TRIGGER}
          />
        }
      />
      <fieldset className="flex flex-col gap-2">
        <legend className={`${CK_LABEL} mb-2`}>{copy.marketingHeading}</legend>
        <div className={ACCOUNT_TOGGLES}>
          {offers.map((c) => (
            <CheckoutToggle key={c.id} label={c.label} checked={c.checked} onChange={c.set} />
          ))}
        </div>
        <span className={`${ACCOUNT_INTRO} text-[0.8125rem]!`}>{copy.marketingNote}</span>
      </fieldset>
      {errors.form ? (
        <p className={ACCOUNT_ERROR} role="alert">
          {errors.form}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:min-w-[12rem]">
          <AccountSubmit label={copy.save} pendingLabel={copy.saving} pending={pending} />
        </div>
        {saved ? (
          <span
            className="inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-ck-success"
            role="status"
          >
            <CheckoutIcon name="check" className="size-4" />
            {copy.saved}
          </span>
        ) : null}
      </div>
    </form>
  )
}
