'use client'

import PhoneInput from '@commerce/blocks/phone-input-lazy'
import type { ReactNode } from 'react'
import { useEffect, useState, useTransition } from 'react'
import AccountCodeStep from '@/components/account/account-code-step'
import AccountSubmit from '@/components/account/account-submit'
import ResendCode from '@/components/account/resend-code'
import CheckoutField from '@/components/checkout/checkout-field'
import { accountContent } from '@/data/account'
import { ACCOUNT_TITLE } from '@/lib/account-classes'
import { CK_INPUT, CK_INPUT_HEIGHT, CK_LABEL, CK_LIFT } from '@/lib/checkout-classes'
import { displayPhone } from '@/lib/display-phone'
import { requestPhoneCodeAction, verifyPhoneCodeAction } from '@/lib/privacy-actions'

type PhoneMethod = 'sms' | 'whatsapp'

type PhoneLoginFormProps = {
  returnTo: string
  /** Phone methods the store offers, in order; at least one. */
  methods: PhoneMethod[]
  /** "Remember this device", when the store offers the choice. */
  remember?: boolean
  /** The "Keep me signed in" box, drawn above Verify on the code step. */
  rememberControl?: ReactNode
  /** Tells the card which step is on screen, so it hides the quick ways in on the code step. */
  onStep?: (codeStep: boolean) => void
}

const copy = accountContent.login
const FIELD_ID = 'login-phone'
/** The checkout's phone box (checkout-contact-fields): the number and the locked +91 side by side. */
const PHONE_INPUT = `${CK_INPUT} ${CK_INPUT_HEIGHT} rounded-s-none!`
const PHONE_TRIGGER = `${CK_INPUT} ${CK_INPUT_HEIGHT} flex! w-auto! gap-1.5 rounded-e-none! border-e-0!`

/** Mobile number, then the six digit code sent by SMS or WhatsApp (Figma 948:15521, 948:15578). */
export default function PhoneLoginForm({
  returnTo,
  methods,
  remember = true,
  rememberControl = null,
  onStep,
}: PhoneLoginFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [phone, setPhone] = useState('')
  const [method, setMethod] = useState<PhoneMethod>(methods[0] ?? 'sms')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onStep?.(sentTo !== null)
  }, [sentTo, onStep])

  // Helpers
  const send = (number: string, by: PhoneMethod = method) => {
    setError(null)
    start(async () => {
      const r = await requestPhoneCodeAction(number, by)
      if (!r.ok) {
        setError(r.error ?? copy.errors.invalidPhone)
        return
      }
      setMethod(by)
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
    if (!sentTo || code.length !== 6) return
    setError(null)
    start(async () => {
      const r = await verifyPhoneCodeAction(sentTo, code, returnTo, remember)
      if (r?.error) setError(r.error)
    })
  }

  const handleBack = () => {
    setSentTo(null)
    setError(null)
  }

  // Render logic
  // The store's other phone method, offered once the resend wait is over: "Get it on WhatsApp".
  const other = methods.find((m) => m !== method) ?? null
  const shownTo = sentTo ? displayPhone(sentTo.startsWith('+') ? sentTo : `+91${sentTo}`) : ''

  return sentTo ? (
    <AccountCodeStep
      sentLine={copy.phoneCodeSent(shownTo, copy.methods[method])}
      code={code}
      onCode={setCode}
      error={error}
      pending={pending}
      onBack={handleBack}
      onSubmit={handleCode}
      extra={rememberControl}
      resend={
        <ResendCode
          key={`${sentTo}-${method}`}
          disabled={pending}
          onResend={() => send(sentTo)}
          other={
            other
              ? { label: copy.getBy(copy.methods[other]), onSend: () => send(sentTo, other) }
              : null
          }
        />
      }
    />
  ) : (
    <form onSubmit={handlePhone} className={`flex flex-col gap-4 ${CK_LIFT}`} noValidate>
      <div className="flex flex-col gap-1.5">
        <h1 className={ACCOUNT_TITLE}>{copy.title}</h1>
        <p className="text-[0.9375rem] text-ck-muted">{copy.phoneIntro}</p>
      </div>
      <CheckoutField
        id={FIELD_ID}
        label={copy.phone}
        error={error}
        control={
          <PhoneInput
            id={FIELD_ID}
            countries={['IN']}
            autoComplete="tel-national"
            placeholder={copy.phonePlaceholder}
            required
            value={phone}
            onChange={setPhone}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${FIELD_ID}-error` : undefined}
            className="rounded-ck"
            inputClassName={PHONE_INPUT}
            triggerClassName={PHONE_TRIGGER}
          />
        }
      />
      {methods.length > 1 ? (
        <fieldset className="flex flex-col gap-2 border-0! p-0!">
          <legend className={`${CK_LABEL} mb-2!`}>{copy.sendBy}</legend>
          <div className="grid grid-cols-2 gap-2">
            {methods.map((m) => (
              <label
                key={m}
                className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-ck border text-[0.875rem] font-medium transition-[border-color,background-color] duration-150 motion-reduce:transition-none has-[:focus-visible]:[box-shadow:0_0_0_3px_var(--ck-ring)] ${method === m ? 'border-ck-accent-lift bg-ck-accent-soft text-ck-ink' : 'border-ck-line bg-ck-field text-ck-muted'}`}
              >
                <input
                  type="radio"
                  name="method"
                  value={m}
                  checked={method === m}
                  onChange={() => setMethod(m)}
                  className="sr-only"
                />
                {copy.methods[m]}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <AccountSubmit label={copy.sendCode} pendingLabel={copy.sending} pending={pending} />
    </form>
  )
}
