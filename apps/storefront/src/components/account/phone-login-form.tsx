'use client'

import PhoneInput from '@commerce/blocks/phone-input-lazy'
import type { ReactNode } from 'react'
import { useState, useTransition } from 'react'
import CodeBoxes from '@/components/account/code-boxes'
import ResendCode from '@/components/account/resend-code'
import { accountContent } from '@/data/account'
import { requestPhoneCodeAction, verifyPhoneCodeAction } from '@/lib/privacy-actions'

type PhoneMethod = 'sms' | 'whatsapp'

type PhoneLoginFormProps = {
  returnTo: string
  /** Phone methods the store offers, in order; at least one. */
  methods: PhoneMethod[]
  note: string
  /** A link to switch to email, when the store offers it too. */
  alternative?: ReactNode
  /** "Remember this device", when the store offers the choice. */
  remember?: boolean
}

const copy = accountContent.login

/** Mobile number, then the six digit code sent by SMS or WhatsApp. */
export default function PhoneLoginForm({
  returnTo,
  methods,
  note,
  alternative,
  remember = true,
}: PhoneLoginFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [phone, setPhone] = useState('')
  const [method, setMethod] = useState<PhoneMethod>(methods[0] ?? 'sms')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Helpers
  const send = (number: string) => {
    setError(null)
    start(async () => {
      const r = await requestPhoneCodeAction(number, method)
      if (!r.ok) {
        setError(r.error ?? copy.errors.invalidPhone)
        return
      }
      setSentTo(r.mobile ?? number)
      setCode('')
    })
  }

  // Event handlers
  const handlePhone = (e: React.FormEvent) => {
    e.preventDefault()
    send(phone)
  }

  const handleCode = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sentTo) return
    setError(null)
    start(async () => {
      const r = await verifyPhoneCodeAction(sentTo, code, returnTo, remember)
      if (r?.error) setError(r.error)
    })
  }

  // Render logic
  const errorLine = error ? (
    <p className="text-small text-danger" role="alert">
      {error}
    </p>
  ) : null

  return sentTo ? (
    <form onSubmit={handleCode} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="h2">{copy.codeTitle}</h1>
        <p className="text-body text-muted">{copy.phoneCodeSent(sentTo, copy.methods[method])}</p>
      </div>
      <CodeBoxes label={copy.code} value={code} onChange={setCode} />
      {errorLine}
      <button
        type="submit"
        className={`btn btn--primary w-full${pending ? ' is-loading' : ''}`}
        disabled={pending || code.length !== 6}
      >
        <span className="btn__label">{pending ? copy.verifying : copy.verify}</span>
      </button>
      <div className="flex flex-wrap justify-between gap-3 text-small">
        <ResendCode key={sentTo} disabled={pending} onResend={() => send(sentTo)} />
        <button
          type="button"
          className="underline underline-offset-4"
          onClick={() => {
            setSentTo(null)
            setError(null)
          }}
        >
          {copy.changePhone}
        </button>
      </div>
    </form>
  ) : (
    <form onSubmit={handlePhone} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="h2">{copy.title}</h1>
        <p className="text-body text-muted">{copy.phoneIntro}</p>
      </div>
      <div className="field">
        <label htmlFor="login-phone" className="field__label text-small">
          {copy.phone}
        </label>
        <PhoneInput
          id="login-phone"
          countries={['IN']}
          autoComplete="tel-national"
          placeholder={copy.phonePlaceholder}
          required
          value={phone}
          onChange={setPhone}
        />
      </div>
      {methods.length > 1 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="field__label text-small">{copy.sendBy}</legend>
          <div className="flex gap-4">
            {methods.map((m) => (
              <label key={m} className="flex items-center gap-2 text-body">
                <input
                  type="radio"
                  name="method"
                  value={m}
                  checked={method === m}
                  onChange={() => setMethod(m)}
                />
                {copy.methods[m]}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {errorLine}
      <button
        type="submit"
        className={`btn btn--primary w-full${pending ? ' is-loading' : ''}`}
        disabled={pending}
      >
        <span className="btn__label">{pending ? copy.sending : copy.sendCode}</span>
      </button>
      {alternative}
      <p className="text-small text-muted">{note}</p>
    </form>
  )
}
