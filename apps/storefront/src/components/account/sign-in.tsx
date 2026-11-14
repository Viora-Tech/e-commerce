'use client'

import type {
  CheckoutAccountMode,
  LoginMethod,
  SignInOptions,
} from '@commerce/core/customer-accounts'
import { useState } from 'react'
import AccountError from '@/components/account/account-error'
import GoogleOneTap from '@/components/account/google-one-tap'
import LoginForm from '@/components/account/login-form'
import PhoneLoginForm from '@/components/account/phone-login-form'
import QuickSignIn from '@/components/account/quick-sign-in'
import { accountContent } from '@/data/account'
import { ACCOUNT_LINK } from '@/lib/account-classes'
import { CK_CARD, CK_LIFT } from '@/lib/checkout-classes'
import type { LoginError } from '@/lib/login-errors'

type SignInProps = {
  returnTo: string
  /** What the store offers, in order; never empty. */
  methods: LoginMethod[]
  checkout: CheckoutAccountMode
  /** Everything else the store switched on (providers, passkeys, magic link). */
  options?: SignInOptions | undefined
  /** The store's own Google client id when One Tap is on. */
  oneTapClientId?: string | null | undefined
  /** Why the last provider sign-in came back without a session. */
  error?: LoginError | null | undefined
  /** A provider sign-in waiting for its email to be confirmed with a code. */
  confirmEmail?: string | null | undefined
}

const copy = accountContent.login

const isPhone = (m: LoginMethod): m is 'sms' | 'whatsapp' => m !== 'email'

/**
 * The sign-in card in the checkout's look (Figma 948:15521, 948:15578): the store's first code
 * method, the one-tap ways in, the switch to the other kind (email or mobile) and passkeys,
 * then who an account is for. The code step shows only the code. One question at a time.
 */
export default function SignIn({
  returnTo,
  methods,
  checkout,
  options,
  oneTapClientId,
  error,
  confirmEmail,
}: SignInProps) {
  // Hooks
  const [mode, setMode] = useState<'email' | 'phone'>(
    confirmEmail || methods[0] === 'email' ? 'email' : 'phone',
  )
  const [remember, setRemember] = useState(true)
  const [codeStep, setCodeStep] = useState(false)

  // Render logic
  const phoneMethods = methods.filter(isPhone)
  const both = methods.includes('email') && phoneMethods.length > 0
  const note = checkout === 'account_required' ? copy.accountNote : copy.guestNote
  const offerRemember = options?.rememberDevice === true
  // Unticked counts only when the store offers the choice; otherwise sessions keep their usual length.
  const keep = offerRemember ? remember : true
  const phone = mode === 'phone' && phoneMethods.length > 0
  const switcher =
    both && !confirmEmail ? (
      <button
        type="button"
        className={ACCOUNT_LINK}
        onClick={() => setMode(phone ? 'email' : 'phone')}
      >
        {phone ? copy.useEmail : copy.usePhone}
      </button>
    ) : null
  const rememberControl = offerRemember ? (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[0.875rem] text-ck-ink">
      <input
        type="checkbox"
        className="size-[1.125rem] shrink-0 accent-[var(--ck-accent)]"
        checked={remember}
        onChange={(e) => setRemember(e.target.checked)}
      />
      {copy.remember}
    </label>
  ) : null

  // `mx-auto!`: an imported theme's own unlayered margin reset beat the centring (#118).
  return (
    <div className="mx-auto! flex w-full max-w-[27.5rem] flex-col items-center gap-5">
      <div className={`${CK_CARD} ${CK_LIFT} flex w-full flex-col gap-5 p-5 sm:p-6`}>
        <AccountError message={error ? copy.providerErrors[error] : null} />
        {phone ? (
          <PhoneLoginForm
            key="phone"
            returnTo={returnTo}
            methods={phoneMethods}
            remember={keep}
            rememberControl={rememberControl}
            onStep={setCodeStep}
          />
        ) : (
          <LoginForm
            key="email"
            returnTo={returnTo}
            remember={keep}
            rememberControl={rememberControl}
            magicLink={options?.magicLink === true}
            confirmEmail={confirmEmail ?? null}
            onStep={setCodeStep}
          />
        )}
        {codeStep ? null : (
          <>
            {options && !confirmEmail ? (
              <QuickSignIn
                options={options}
                returnTo={returnTo}
                remember={keep}
                switcher={switcher}
              />
            ) : (
              switcher
            )}
            {rememberControl}
            <p className="border-t border-ck-line pt-4 text-[0.8125rem] leading-relaxed text-ck-muted">
              {note}
            </p>
          </>
        )}
        {oneTapClientId && !confirmEmail ? (
          <GoogleOneTap clientId={oneTapClientId} returnTo={returnTo} remember={keep} />
        ) : null}
      </div>
      {/* What an account gives, under the card (Figma 948:15521). */}
      <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[0.8125rem] text-ck-muted">
        {copy.perks.map((p) => (
          <li key={p} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-ck-accent-lift" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  )
}
