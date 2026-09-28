import type { SignInOptions, SocialProvider } from '@commerce/core/customer-accounts'

/** One quick sign-in button under the code form. */
export type QuickButton =
  | { kind: 'social'; provider: SocialProvider }
  | { kind: 'truecaller' }
  | { kind: 'passkey' }

export type DeviceHints = {
  /** Truecaller's web flow answers only on Android with the app installed. */
  android: boolean
  /** The browser can use passkeys (`PublicKeyCredential` exists). */
  webauthn: boolean
}

/**
 * The buttons the sign-in card shows, in order: only methods the store switched on and
 * set up, and only what this device can use. Truecaller first on Android (one tap, no
 * code), then providers in the store's order, then passkeys.
 */
export function quickSignInButtons(options: SignInOptions, device: DeviceHints): QuickButton[] {
  const out: QuickButton[] = []
  if (options.truecaller && device.android) out.push({ kind: 'truecaller' })
  for (const provider of options.social) out.push({ kind: 'social', provider })
  if (options.passkeys && device.webauthn) out.push({ kind: 'passkey' })
  return out
}

/** The store-domain URL that starts a provider sign-in. */
export function socialStartHref(
  provider: SocialProvider,
  input: { returnTo: string; remember: boolean; connect?: boolean },
): string {
  const q = new URLSearchParams({ return_to: input.returnTo })
  if (input.remember) q.set('remember', '1')
  if (input.connect) q.set('connect', '1')
  return `/account/login/social/${provider}?${q.toString()}`
}
