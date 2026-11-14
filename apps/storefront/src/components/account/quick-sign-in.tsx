'use client'

import type { SignInOptions } from '@commerce/core/customer-accounts'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import PasskeyButton from '@/components/account/passkey-button'
import TruecallerButton from '@/components/account/truecaller-button'
import { accountContent } from '@/data/account'
import { ACCOUNT_LINK } from '@/lib/account-classes'
import {
  CK_BUTTON_PRIMARY,
  CK_BUTTON_SECONDARY,
  CK_INPUT,
  CK_INPUT_HEIGHT,
} from '@/lib/checkout-classes'
import { type DeviceHints, quickSignInButtons, socialStartHref } from '@/lib/sign-in-buttons'

type QuickSignInProps = {
  options: SignInOptions
  returnTo: string
  remember: boolean
  /** Left of the passkey link: "Use email instead", when the store offers both kinds. */
  switcher?: ReactNode
}

const copy = accountContent.login
const BUTTON = `${CK_BUTTON_SECONDARY} h-12! w-full`
const TRUECALLER = {
  button: BUTTON,
  primary: CK_BUTTON_PRIMARY,
  input: `${CK_INPUT} ${CK_INPUT_HEIGHT} text-center! tracking-[0.5em]`,
}

/**
 * The one-tap ways in under the code form (Figma 948:15521): "or", then Truecaller, Google,
 * Apple and Facebook as outlined buttons, then a row with the switch to email or mobile and
 * "Sign in with a passkey". Only what the store switched on and this device can use.
 */
export default function QuickSignIn({
  options,
  returnTo,
  remember,
  switcher = null,
}: QuickSignInProps) {
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

  // Render logic
  const all = quickSignInButtons(options, device)
  const buttons = all.filter((b) => b.kind !== 'passkey')
  const passkey = all.some((b) => b.kind === 'passkey')

  return (
    <div className="flex flex-col gap-3">
      {buttons.length > 0 ? (
        <>
          <p className="flex items-center gap-3 text-[0.8125rem] text-ck-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-ck-line" />
            {copy.or}
            <span className="h-px flex-1 bg-ck-line" />
          </p>
          {buttons.map((b) =>
            b.kind === 'truecaller' ? (
              <TruecallerButton
                key="truecaller"
                returnTo={returnTo}
                remember={remember}
                classes={TRUECALLER}
              />
            ) : b.kind === 'social' ? (
              <a
                key={b.provider}
                className={BUTTON}
                href={socialStartHref(b.provider, { returnTo, remember })}
              >
                {copy.providers[b.provider]}
              </a>
            ) : null,
          )}
        </>
      ) : null}
      {switcher || passkey ? (
        <div className="flex flex-wrap items-start justify-between gap-x-4">
          {switcher ?? <span />}
          {passkey ? (
            <PasskeyButton returnTo={returnTo} remember={remember} buttonClassName={ACCOUNT_LINK} />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
