'use client'

import type { CheckoutAccountMode, LoginMethod } from '@commerce/core/customer-accounts'
import { useState } from 'react'
import LoginForm from '@/components/account/login-form'
import PhoneLoginForm from '@/components/account/phone-login-form'
import { accountContent } from '@/data/account'

type SignInProps = {
  returnTo: string
  /** What the store offers, in order; never empty. */
  methods: LoginMethod[]
  checkout: CheckoutAccountMode
}

const copy = accountContent.login

const isPhone = (m: LoginMethod): m is 'sms' | 'whatsapp' => m !== 'email'

/**
 * The sign-in card: the store's first method, with a link to the other kind
 * (email or mobile) when both are on. One question at a time.
 */
export default function SignIn({ returnTo, methods, checkout }: SignInProps) {
  // Hooks
  const [mode, setMode] = useState<'email' | 'phone'>(methods[0] === 'email' ? 'email' : 'phone')

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

  return (
    <div className="mx-auto w-full max-w-[26rem] rounded-2xl border border-line p-8">
      {mode === 'phone' && phoneMethods.length > 0 ? (
        <PhoneLoginForm
          returnTo={returnTo}
          methods={phoneMethods}
          note={note}
          alternative={switcher('email')}
        />
      ) : (
        <LoginForm returnTo={returnTo} note={note} alternative={switcher('phone')} />
      )}
    </div>
  )
}
