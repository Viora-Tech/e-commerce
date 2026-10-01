import type { SignInOptions } from '@commerce/core/customer-accounts'
import { describe, expect, it } from 'vitest'
import { quickSignInButtons, socialStartHref, truecallerStartAllowed } from './sign-in-buttons'

const base: SignInOptions = {
  codes: ['email'],
  social: [],
  oneTap: false,
  truecaller: false,
  magicLink: false,
  passkeys: false,
  rememberDevice: false,
}
const phone = { android: true, webauthn: true, topLevel: true }

describe('quick sign-in buttons (enabled methods only)', () => {
  it('shows nothing extra when only codes are on', () => {
    expect(quickSignInButtons(base, phone)).toEqual([])
  })

  it('shows exactly the enabled providers, in order', () => {
    expect(quickSignInButtons({ ...base, social: ['google', 'facebook'] }, phone)).toEqual([
      { kind: 'social', provider: 'google' },
      { kind: 'social', provider: 'facebook' },
    ])
  })

  it('puts Truecaller first, on Android only', () => {
    const o = { ...base, social: ['apple' as const], truecaller: true }
    expect(quickSignInButtons(o, phone)).toEqual([
      { kind: 'truecaller' },
      { kind: 'social', provider: 'apple' },
    ])
    expect(quickSignInButtons(o, { android: false, webauthn: true, topLevel: true })).toEqual([
      { kind: 'social', provider: 'apple' },
    ])
  })

  it('never offers Truecaller inside a frame (D-03)', () => {
    const o = { ...base, truecaller: true }
    expect(quickSignInButtons(o, { ...phone, topLevel: false })).toEqual([])
  })

  it('starts Truecaller only from the store’s own origin (D-03)', () => {
    const store = 'https://shop.example.in'
    expect(truecallerStartAllowed('https://shop.example.in', store)).toBe(true)
    expect(truecallerStartAllowed('https://evil.example', store)).toBe(false)
    expect(truecallerStartAllowed('http://shop.example.in', store)).toBe(false)
    expect(truecallerStartAllowed('https://shop.example.in:8443', store)).toBe(false)
    expect(truecallerStartAllowed(null, store)).toBe(false)
  })

  it('shows passkeys only where the browser supports them', () => {
    expect(quickSignInButtons({ ...base, passkeys: true }, phone)).toEqual([{ kind: 'passkey' }])
    expect(
      quickSignInButtons({ ...base, passkeys: true }, { android: true, webauthn: false, topLevel: true }),
    ).toEqual([])
  })

  it('builds the start link on the store domain', () => {
    expect(socialStartHref('google', { returnTo: '/cart', remember: true })).toBe(
      '/account/login/social/google?return_to=%2Fcart&remember=1',
    )
    expect(socialStartHref('apple', { returnTo: '/account', remember: false, connect: true })).toBe(
      '/account/login/social/apple?return_to=%2Faccount&connect=1',
    )
  })
})
