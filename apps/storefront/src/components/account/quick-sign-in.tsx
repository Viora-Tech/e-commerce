'use client'

import type { SignInOptions } from '@commerce/core/customer-accounts'
import { useEffect, useState } from 'react'
import PasskeyButton from '@/components/account/passkey-button'
import TruecallerButton from '@/components/account/truecaller-button'
import { accountContent } from '@/data/account'
import { type DeviceHints, quickSignInButtons, socialStartHref } from '@/lib/sign-in-buttons'

type QuickSignInProps = {
  options: SignInOptions
  returnTo: string
  remember: boolean
}

const copy = accountContent.login

/**
 * The one-tap ways in under the code form: Truecaller, Google, Apple, Facebook and
 * passkeys, only those the store switched on and this device can use.
 */
export default function QuickSignIn({ options, returnTo, remember }: QuickSignInProps) {
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
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-3 text-small text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        {copy.or}
        <span className="h-px flex-1 bg-line" />
      </p>
      {buttons.map((b) => {
        if (b.kind === 'truecaller') {
          return <TruecallerButton key="truecaller" returnTo={returnTo} remember={remember} />
        }
        if (b.kind === 'passkey') {
          return <PasskeyButton key="passkey" returnTo={returnTo} remember={remember} />
        }
        return (
          <a
            key={b.provider}
            className="btn btn--secondary w-full"
            href={socialStartHref(b.provider, { returnTo, remember })}
          >
            <span className="btn__label">{copy.providers[b.provider]}</span>
          </a>
        )
      })}
    </div>
  )
}
