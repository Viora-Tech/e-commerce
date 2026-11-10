'use client'

import type {
  CheckoutAccountMode,
  LoginMethod,
  SignInOptions,
} from '@commerce/core/customer-accounts'
import { useState } from 'react'
import GoogleOneTap from '@/components/account/google-one-tap'
import LoginForm from '@/components/account/login-form'
import PhoneLoginForm from '@/components/account/phone-login-form'
import QuickSignIn from '@/components/account/quick-sign-in'
import { accountContent } from '@/data/account'
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
 * The sign-in card: the store's first code method, with a link to the other kind
 * (email or mobile) when both are on, then the one-tap ways in the store switched on.
 * One question at a time.
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

  // Helpers
  /** A link to the other kind of sign-in, only when the store offers both. */
  const switcher = (to: 'email' | 'phone') =>
    methods.includes('email') && methods.some(isPhone) ? (
      <button
        type="button"
        className="text-small underline underline-offset-4"
        onClick={() => setMode(to)}
      >
        {to === 'phone' ? copy.usePhone : copy.useEmail}
      </button>
    ) : null

  // Render logic
  const phoneMethods = methods.filter(isPhone)
  const note = checkout === 'account_required' ? copy.accountNote : copy.guestNote
  const offerRemember = options?.rememberDevice === true
  // Unticked counts only when the store offers the choice; otherwise sessions keep their usual length.
  const keep = offerRemember ? remember : true

  // `mx-auto!`: an imported theme's own unlayered margin reset beat the centring (#118).
  return (
    <div className="mx-auto! flex w-full max-w-[27.5rem] flex-col items-center gap-5">
      <div className="flex w-full flex-col gap-6 rounded-[1.25rem] border border-line bg-surface p-6 shadow-[0_1.5rem_4rem_rgba(0,0,0,0.28)] md:p-8">
        {error ? (
          <p className="text-small text-danger" role="alert">
            {copy.providerErrors[error]}
          </p>
        ) : null}
        {mode === 'phone' && phoneMethods.length > 0 ? (
          <PhoneLoginForm
            returnTo={returnTo}
            methods={phoneMethods}
            note={note}
            alternative={switcher('email')}
            remember={keep}
          />
        ) : (
          <LoginForm
            returnTo={returnTo}
            note={note}
            alternative={switcher('phone')}
            remember={keep}
            magicLink={options?.magicLink === true}
            confirmEmail={confirmEmail ?? null}
          />
        )}
        {options && !confirmEmail ? (
          <QuickSignIn options={options} returnTo={returnTo} remember={keep} />
        ) : null}
        {offerRemember ? (
          <label className="flex items-start gap-3 text-body">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[var(--color-ink)]"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span className="flex flex-col">
              <span>{copy.remember}</span>
              <span className="text-small text-muted">{copy.rememberHint}</span>
            </span>
          </label>
        ) : null}
        {oneTapClientId && !confirmEmail ? (
          <GoogleOneTap clientId={oneTapClientId} returnTo={returnTo} remember={keep} />
        ) : null}
      </div>
      {/* What an account gives, under the card (Figma 948:15521). */}
      <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-small text-muted">
        {copy.perks.map((p) => (
          <li key={p} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-[var(--color-ink)] opacity-60"
            />
            {p}
          </li>
        ))}
      </ul>
    </div>
  )
}
