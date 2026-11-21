'use client'

import type { SocialProvider } from '@commerce/core/customer-accounts'
import { startRegistration } from '@simplewebauthn/browser'
import { useState, useTransition } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { accountContent } from '@/data/account'
import {
  ACCOUNT_CARD,
  ACCOUNT_CARD_TITLE,
  ACCOUNT_ERROR,
  ACCOUNT_INTRO,
  ACCOUNT_LINK_DANGER,
  ACCOUNT_ROW,
  ACCOUNT_ROWS,
} from '@/lib/account-classes'
import { CK_BUTTON_SECONDARY } from '@/lib/checkout-classes'
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

/** "Passkeys", "Connected accounts": a small heading with its icon. */
const SUB_TITLE =
  'flex items-center gap-2 font-ck! normal-case! tracking-normal! text-[0.9375rem]! leading-snug! font-semibold! text-ck-ink! opacity-100! translate-none!'

/** The bordered list the passkeys and connected accounts sit in. */
const LIST = 'rounded-ck border border-ck-line'

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

  // Render logic
  return (
    <section className={`${ACCOUNT_CARD} max-w-[40rem] gap-5!`} aria-labelledby="security-title">
      <div className="flex flex-col gap-1">
        <h2 id="security-title" className={ACCOUNT_CARD_TITLE}>
          {copy.title}
        </h2>
        <p className={ACCOUNT_INTRO}>{copy.intro}</p>
      </div>

      {passkeysOn || passkeys.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className={SUB_TITLE}>
            <CheckoutIcon name="key" className="size-4 text-ck-muted" />
            {copy.passkeysTitle}
          </h3>
          <p className="text-[0.8125rem] text-ck-muted">{copy.passkeysIntro}</p>
          {passkeys.length === 0 ? (
            <p className="text-[0.8125rem] text-ck-muted">{copy.noPasskeys}</p>
          ) : (
            <ul className={`${ACCOUNT_ROWS} ${LIST}`}>
              {passkeys.map((p, i) => (
                <li key={p.id} className={`${ACCOUNT_ROW} px-4`}>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[0.9375rem] text-ck-ink">
                      {p.name || copy.passkeyName(i + 1)}
                    </span>
                    {p.rpId !== hostname ? (
                      <span className="text-[0.8125rem] text-ck-muted">
                        {copy.otherDomain(p.rpId)}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className={ACCOUNT_LINK_DANGER}
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
              className={`${CK_BUTTON_SECONDARY} w-full sm:w-fit`}
              onClick={handleAddPasskey}
              disabled={pending}
              aria-busy={pending || undefined}
            >
              <CheckoutIcon
                name={pending ? 'spinner' : 'plus'}
                className={`size-4 ${pending ? 'animate-spin motion-reduce:animate-none' : ''}`}
              />
              {pending ? copy.adding : copy.addPasskey}
            </button>
          ) : null}
          {message ? (
            <p
              className={message.tone === 'ok' ? 'text-[0.8125rem] text-ck-success' : ACCOUNT_ERROR}
              role={message.tone === 'ok' ? 'status' : 'alert'}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      ) : null}

      {identities.length > 0 || connectable.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-ck-line pt-5">
          <h3 className={SUB_TITLE}>
            <CheckoutIcon name="user" className="size-4 text-ck-muted" />
            {copy.connectedTitle}
          </h3>
          <p className="text-[0.8125rem] text-ck-muted">{copy.connectedIntro}</p>
          {identities.length > 0 ? (
            <ul className={`${ACCOUNT_ROWS} ${LIST}`}>
              {identities.map((i) => (
                <li key={i.id} className={`${ACCOUNT_ROW} px-4`}>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[0.9375rem] text-ck-ink">
                      {copy.providerNames[i.provider]}
                    </span>
                    {i.email ? (
                      <span className="truncate text-[0.8125rem] text-ck-muted">{i.email}</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className={ACCOUNT_LINK_DANGER}
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
              className={`${CK_BUTTON_SECONDARY} w-full sm:w-fit`}
              href={socialStartHref(p, {
                returnTo: '/account/profile',
                remember: true,
                connect: true,
              })}
            >
              {copy.connect(copy.providerNames[p])}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  )
}
