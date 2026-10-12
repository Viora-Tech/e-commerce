'use client'

import type { SignInOptions } from '@commerce/core/customer-accounts'
import { useEffect, useState } from 'react'
import PasskeyButton from '@/components/account/passkey-button'
import TruecallerButton from '@/components/account/truecaller-button'
import { accountContent } from '@/data/account'
import {
  CK_BUTTON_PRIMARY,
  CK_BUTTON_SECONDARY,
  CK_INPUT,
  CK_INPUT_HEIGHT,
} from '@/lib/checkout-classes'
import { type DeviceHints, quickSignInButtons, socialStartHref } from '@/lib/sign-in-buttons'

type CheckoutQuickSignInProps = { options: SignInOptions }

const copy = accountContent.login
/** Every way in comes back to the checkout's first step, signed in. */
const RETURN_TO = '/checkout'
const BUTTON = `${CK_BUTTON_SECONDARY} w-full`
const TRUECALLER = {
  button: BUTTON,
  primary: CK_BUTTON_PRIMARY,
  input: `${CK_INPUT} ${CK_INPUT_HEIGHT} text-center! tracking-[0.5em]`,
}

/**
 * The store's one-tap ways in under the code, in the checkout's look: Truecaller (Android),
 * Google, Apple, Facebook and passkeys, only those Settings → Customer accounts switched on
 * and this device can use. Same flows as the account page; none renders a `<form>` here.
 */
export default function CheckoutQuickSignIn({ options }: CheckoutQuickSignInProps) {
  // Hooks
  // Before hydration nothing device-specific shows, so server and client markup agree.
  const [device, setDevice] = useState<DeviceHints>({
    android: false,
    webauthn: false,
    topLevel: false,
  })

  useEffect(() => {
    setDevice({
      android: /Android/i.test(navigator.userAgent),
      webauthn: typeof window.PublicKeyCredential === 'function',
      topLevel: window.top === window.self,
    })
  }, [])

  // Early returns
  const buttons = quickSignInButtons(options, device)
  if (buttons.length === 0) return null

  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex items-center gap-3 text-[0.8125rem] text-ck-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-ck-line" />
        {copy.or}
        <span className="h-px flex-1 bg-ck-line" />
      </p>
      {buttons.map((b) => {
        if (b.kind === 'truecaller') {
          return (
            <TruecallerButton
              key="truecaller"
              returnTo={RETURN_TO}
              remember
              inForm
              classes={TRUECALLER}
            />
          )
        }
        if (b.kind === 'passkey') {
          return (
            <PasskeyButton key="passkey" returnTo={RETURN_TO} remember buttonClassName={BUTTON} />
          )
        }
        return (
          <a
            key={b.provider}
            className={BUTTON}
            href={socialStartHref(b.provider, { returnTo: RETURN_TO, remember: true })}
          >
            {copy.providers[b.provider]}
          </a>
        )
      })}
    </div>
  )
}
