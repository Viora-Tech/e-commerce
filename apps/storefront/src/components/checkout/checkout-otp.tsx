'use client'

import PhoneInput from '@commerce/blocks/phone-input-lazy'
import type { LoginMethod } from '@commerce/core/customer-accounts'
import { useEffect, useRef, useState, useTransition } from 'react'
import CheckoutField from '@/components/checkout/checkout-field'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { accountContent } from '@/data/account'
import { checkoutContent as content } from '@/data/checkout'
import { requestCodeAction, verifyCodeAction } from '@/lib/account-actions'
import {
  CK_BUTTON_PRIMARY,
  CK_INPUT,
  CK_INPUT_HEIGHT,
  CK_LABEL,
  CK_LINK,
} from '@/lib/checkout-classes'
import {
  type OtpActions,
  type OtpChannel,
  type PhoneMethod,
  requestOtp,
  verifyOtp,
} from '@/lib/checkout-otp'
import { fieldId } from '@/lib/checkout-validation'
import { displayPhone } from '@/lib/display-phone'
import { requestPhoneCodeAction, verifyPhoneCodeAction } from '@/lib/privacy-actions'
import { SEND_CODE_ID } from '@/lib/use-checkout-form'

type CheckoutOtpProps = {
  /** The checkout's own contact fields: the number (or email) typed here is the order's. */
  phone: string
  email: string
  /** Code methods the store can send, in order; never empty. */
  methods: LoginMethod[]
  onPhone: (value: string) => void
  onEmail: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** Why to sign in here: required by the store, or a shortcut to saved addresses. */
  note: string
}

/** The store's own sign-in actions, as on the account page. */
const ACTIONS: OtpActions = {
  requestPhone: requestPhoneCodeAction,
  requestEmail: requestCodeAction,
  verifyPhone: (mobile, code, returnTo) => verifyPhoneCodeAction(mobile, code, returnTo),
  verifyEmail: (email, code, returnTo) => verifyCodeAction(email, code, returnTo),
}
const login = accountContent.login
const otp = content.otp
const isPhoneMethod = (m: LoginMethod): m is PhoneMethod => m !== 'email'
const CODE_ID = 'checkout-otp-code'

/**
 * Contact, phone first: the store's own sign-in codes (SMS or WhatsApp, or email) through
 * `lib/checkout-otp.ts`, the same server actions and limits as the account page (per number
 * and per IP, the resend lockout, attempt caps; a new number becomes a new account and the
 * answer never says which). Verifying signs the shopper in and reloads the checkout with
 * their saved addresses. No `<form>`: it
 * lives inside the checkout's one form (#224); its button carries `SEND_CODE_ID`, so Enter
 * and Continue press it.
 */
export default function CheckoutOtp({
  phone,
  email,
  methods,
  onPhone,
  onEmail,
  note,
}: CheckoutOtpProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [channel, setChannel] = useState<OtpChannel>(
    methods.some(isPhoneMethod) ? 'phone' : 'email',
  )
  const [method, setMethod] = useState<PhoneMethod>(() => methods.find(isPhoneMethod) ?? 'sms')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (sentTo) codeRef.current?.focus()
  }, [sentTo])

  // Helpers
  const send = () => {
    setError(null)
    start(async () => {
      const r = await requestOtp({ channel, phone, email, method }, ACTIONS)
      if (r.ok) {
        setSentTo(r.sentTo)
        setCode('')
        return
      }
      setError(r.error)
      if (r.field) document.getElementById(fieldId(r.field))?.focus()
    })
  }
  const verify = (typed = code) => {
    if (!sentTo) return
    if (typed.length !== 6) {
      codeRef.current?.focus()
      return
    }
    setError(null)
    start(async () => {
      const failed = await verifyOtp({ channel, sentTo, code: typed }, ACTIONS)
      if (failed) setError(failed)
    })
  }

  // Event handlers
  const handlePrimary = () => (sentTo ? verify() : send())
  const handleCode = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(next)
    // The sixth digit (typed or pasted) sends the code: no extra tap on Verify.
    if (next.length === 6 && code.length < 6 && !pending) verify(next)
  }
  const handleRestart = () => {
    setSentTo(null)
    setCode('')
    setError(null)
  }
  const handleChannel = () => {
    setChannel((c) => (c === 'phone' ? 'email' : 'phone'))
    handleRestart()
  }

  // Render logic
  const phoneMethods = methods.filter(isPhoneMethod)
  const both = methods.includes('email') && phoneMethods.length > 0
  // Phone codes go to the ten-digit number; show it the way the shopper typed it.
  const shownTo = channel === 'phone' && sentTo ? displayPhone(`+91${sentTo}`) : (sentTo ?? '')
  const label = pending
    ? sentTo
      ? otp.verifying
      : otp.sending
    : sentTo
      ? otp.verify
      : otp.sendCode

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[0.875rem] text-ck-muted">
        {channel === 'phone' ? otp.intro : otp.introEmail}
      </p>
      {sentTo ? (
        <div className="flex flex-col gap-3">
          <p className="flex flex-wrap items-center gap-x-2 text-[0.875rem] text-ck-ink">
            {channel === 'phone'
              ? otp.sentTo(shownTo, login.methods[method])
              : otp.sentToEmail(shownTo)}
            <button type="button" onClick={handleRestart} className={CK_LINK}>
              {otp.change}
            </button>
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={CODE_ID} className={CK_LABEL}>
              {otp.codeLabel}
            </label>
            <input
              ref={codeRef}
              id={CODE_ID}
              className={`${CK_INPUT} ${CK_INPUT_HEIGHT} text-center! tracking-[0.5em] tabular-nums`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={handleCode}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'checkout-otp-error' : undefined}
            />
          </div>
        </div>
      ) : channel === 'phone' ? (
        <div className="flex flex-col gap-3">
          <CheckoutField
            id={fieldId('phone')}
            label={content.fields.phone}
            control={
              <PhoneInput
                id={fieldId('phone')}
                countries={['IN']}
                required
                autoComplete="tel-national"
                placeholder={content.fields.phonePlaceholder}
                value={phone}
                onChange={onPhone}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'checkout-otp-error' : undefined}
                className="rounded-ck"
                inputClassName={`${CK_INPUT} ${CK_INPUT_HEIGHT} rounded-s-none!`}
                triggerClassName={`${CK_INPUT} ${CK_INPUT_HEIGHT} flex! w-auto! gap-1.5 rounded-e-none! border-e-0!`}
              />
            }
          />
          {phoneMethods.length > 1 ? (
            <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 border-0! p-0!">
              <legend className={`${CK_LABEL} mb-2!`}>{login.sendBy}</legend>
              {phoneMethods.map((m) => (
                <label key={m} className="flex cursor-pointer items-center gap-2 text-[0.875rem]">
                  <input
                    type="radio"
                    name="checkout-otp-method"
                    value={m}
                    checked={method === m}
                    onChange={() => setMethod(m)}
                    className="size-4 accent-[var(--ck-accent)]"
                  />
                  {login.methods[m]}
                </label>
              ))}
            </fieldset>
          ) : null}
        </div>
      ) : (
        <CheckoutField
          id={fieldId('email')}
          label={content.fields.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={content.fields.emailPlaceholder}
          value={email}
          onChange={onEmail}
        />
      )}
      <div aria-live="polite">
        {error ? (
          <p
            id="checkout-otp-error"
            className="flex items-start gap-2 text-[0.8125rem] text-ck-danger"
          >
            <CheckoutIcon name="alert" className="mt-0.5! size-4" />
            {error}
          </p>
        ) : null}
      </div>
      <button
        id={SEND_CODE_ID}
        type="button"
        onClick={handlePrimary}
        disabled={pending}
        aria-busy={pending}
        className={`${CK_BUTTON_PRIMARY} h-12!`}
      >
        {pending ? (
          <CheckoutIcon name="spinner" className="size-4 animate-spin motion-reduce:animate-none" />
        ) : null}
        {label}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {sentTo ? (
          <button type="button" onClick={send} disabled={pending} className={CK_LINK}>
            {otp.resend}
          </button>
        ) : both ? (
          <button type="button" onClick={handleChannel} className={CK_LINK}>
            {channel === 'phone' ? login.useEmail : login.usePhone}
          </button>
        ) : (
          <span />
        )}
      </div>
      <p className="text-[0.8125rem] text-ck-muted">{note}</p>
    </div>
  )
}
