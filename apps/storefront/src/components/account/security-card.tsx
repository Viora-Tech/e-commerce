'use client'

import type { SocialProvider } from '@commerce/core/customer-accounts'
import { startRegistration } from '@simplewebauthn/browser'
import { useState, useTransition } from 'react'
import { accountContent } from '@/data/account'
import {
  passkeyRegisterAction,
  passkeyRegisterOptionsAction,
  removeIdentityAction,
  removePasskeyAction,
} from '@/lib/login-actions'
import { socialStartHref } from '@/lib/sign-in-buttons'

type SecurityCardProps = {
  /** The store offers passkeys. */
  passkeysOn: boolean
  passkeys: { id: string; name: string | null; rpId: string }[]
  identities: {
    id: string
    provider: keyof typeof accountContent.security.providerNames
    email: string | null
  }[]
  /** Providers the store offers that this shopper has not connected yet. */
  connectable: SocialProvider[]
  /** This site's hostname; passkeys made on another domain are marked. */
  hostname: string
}

const copy = accountContent.security

/** A short device label for the passkey list, from the browser. */
function deviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad/i.test(ua)) return copy.devices.ios
  if (/Android/i.test(ua)) return copy.devices.android
  if (/Mac/i.test(ua)) return copy.devices.mac
  if (/Windows/i.test(ua)) return copy.devices.windows
  return ''
}

/** Account page: passkeys on this device and connected sign-in accounts. */
export default function SecurityCard({
  passkeysOn,
  passkeys,
  identities,
  connectable,
  hostname,
}: SecurityCardProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  // Event handlers
  const handleAddPasskey = () => {
    setMessage(null)
    start(async () => {
      const options = await passkeyRegisterOptionsAction()
      if (!options) {
        setMessage({ tone: 'error', text: accountContent.login.errors.unavailable })
        return
      }
      let response: unknown
      try {
        response = await startRegistration({ optionsJSON: options })
      } catch {
        setMessage({ tone: 'error', text: accountContent.login.errors.passkeyFailed })
        return
      }
      const r = await passkeyRegisterAction(response, deviceName())
      setMessage(
        r.ok
          ? { tone: 'ok', text: copy.added }
          : { tone: 'error', text: r.error ?? accountContent.login.errors.passkeyFailed },
      )
    })
  }

  const handleRemovePasskey = (id: string) => {
    start(async () => {
      await removePasskeyAction(id)
    })
  }

  const handleRemoveIdentity = (id: string) => {
    start(async () => {
      await removeIdentityAction(id)
    })
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="security-title">
      <div className="flex flex-col gap-1">
        <h2 id="security-title" className="h4">
          {copy.title}
        </h2>
        <p className="text-body text-muted">{copy.intro}</p>
      </div>

      {passkeysOn || passkeys.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-body font-semibold">{copy.passkeysTitle}</h3>
          <p className="text-small text-muted">{copy.passkeysIntro}</p>
          {passkeys.length === 0 ? (
            <p className="text-small text-muted">{copy.noPasskeys}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
              {passkeys.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between gap-3 p-4">
                  <span className="flex flex-col">
                    <span className="text-body">{p.name || copy.passkeyName(i + 1)}</span>
                    {p.rpId !== hostname ? (
                      <span className="text-small text-muted">{copy.otherDomain(p.rpId)}</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="text-small underline underline-offset-4 disabled:opacity-50"
                    onClick={() => handleRemovePasskey(p.id)}
                    disabled={pending}
                  >
                    {copy.remove}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {passkeysOn ? (
            <button
              type="button"
              className={`btn btn--secondary w-full sm:w-fit${pending ? ' is-loading' : ''}`}
              onClick={handleAddPasskey}
              disabled={pending}
            >
              <span className="btn__label">{pending ? copy.adding : copy.addPasskey}</span>
            </button>
          ) : null}
          {message ? (
            <p
              className={`text-small ${message.tone === 'ok' ? 'text-muted' : 'text-danger'}`}
              role={message.tone === 'ok' ? 'status' : 'alert'}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      ) : null}

      {identities.length > 0 || connectable.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-body font-semibold">{copy.connectedTitle}</h3>
          <p className="text-small text-muted">{copy.connectedIntro}</p>
          {identities.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
              {identities.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 p-4">
                  <span className="flex flex-col">
                    <span className="text-body">{copy.providerNames[i.provider]}</span>
                    {i.email ? <span className="text-small text-muted">{i.email}</span> : null}
                  </span>
                  <button
                    type="button"
                    className="text-small underline underline-offset-4 disabled:opacity-50"
                    onClick={() => handleRemoveIdentity(i.id)}
                    disabled={pending}
                  >
                    {copy.remove}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {connectable.map((p) => (
            <a
              key={p}
              className="btn btn--secondary w-full sm:w-fit"
              href={socialStartHref(p, {
                returnTo: '/account/profile',
                remember: true,
                connect: true,
              })}
            >
              <span className="btn__label">{copy.connect(copy.providerNames[p])}</span>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  )
}
