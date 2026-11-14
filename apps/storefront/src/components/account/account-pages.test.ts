/** SOURCE OF TRUTH: shopper sign-in and order pages markup — WHAT: fields, tap targets, states, routes / WHY: account pages redesign in the checkout's look (Figma 948:15521, 705:114276) */
import type { ShopperOrderSummary } from '@commerce/core'
import type { SignInOptions } from '@commerce/core/customer-accounts'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/account-actions', () => ({
  requestCodeAction: vi.fn(),
  verifyCodeAction: vi.fn(),
  reorderAction: vi.fn(),
}))
vi.mock('@/lib/privacy-actions', () => ({
  requestPhoneCodeAction: vi.fn(),
  verifyPhoneCodeAction: vi.fn(),
}))
vi.mock('@/lib/login-actions', () => ({
  requestMagicLinkAction: vi.fn(),
  passkeyLoginOptionsAction: vi.fn(),
  passkeySignInAction: vi.fn(),
  startTruecallerAction: vi.fn(),
  pollTruecallerAction: vi.fn(),
  confirmTruecallerCodeAction: vi.fn(),
}))
const { default: SignIn } = await import('./sign-in')
const { default: OrderList } = await import('./order-list')
const { default: ResendCode } = await import('./resend-code')

const options: SignInOptions = {
  codes: ['sms', 'email'],
  social: ['google'],
  oneTap: false,
  truecaller: false,
  magicLink: true,
  passkeys: false,
  rememberDevice: true,
}

const order = (over: Partial<ShopperOrderSummary> = {}): ShopperOrderSummary => ({
  id: 'o1',
  number: 1042,
  placedAt: new Date('2026-10-12T10:00:00Z'),
  status: 'open',
  paymentStatus: 'paid',
  fulfillmentStatus: 'fulfilled',
  totalPaise: 1_034_600,
  itemCount: 3,
  payment: 'paid',
  shipment: 'in_transit',
  firstImage: { url: 'https://cdn.example/a.jpg', alt: 'Mouse' },
  thumbnails: [
    { url: 'https://cdn.example/a.jpg', alt: 'Mouse' },
    { url: 'https://cdn.example/b.jpg', alt: null },
  ],
  ...over,
})

describe('SignIn', () => {
  it('asks for the mobile number first, with a labelled tel field and the store’s ways in', () => {
    const html = renderToStaticMarkup(
      createElement(SignIn, {
        returnTo: '/account',
        methods: ['sms', 'email'],
        checkout: 'guest',
        options,
      }),
    )
    expect(html).toContain('<label for="login-phone"')
    // The number box loads lazily; its stand-in is already a tel input.
    expect(html).toContain('type="tel"')
    expect(html).toContain('Send code')
    expect(html).toContain('Continue with Google')
    expect(html).toContain('Use email instead')
    expect(html).toContain('Keep me signed in on this device')
    // The card rises in, and only a fade under reduced motion.
    expect(html).toContain('motion-safe:animate-[ck-lift')
    expect(html).toContain('motion-reduce:animate-[sf-fade')
    // Quiet links keep a full 2.75rem tap.
    expect(html).toContain('min-h-11')
  })

  it('starts on email with an email field when the store offers email first', () => {
    const html = renderToStaticMarkup(
      createElement(SignIn, {
        returnTo: '/account',
        methods: ['email'],
        checkout: 'account_required',
        options,
      }),
    )
    expect(html).toContain('type="email" inputMode="email"')
    expect(html).toContain('autoComplete="email"')
    expect(html).toContain('Email me a sign-in link instead')
    expect(html).not.toContain('Use mobile number instead')
  })

  it('shows a provider error in the card as an alert', () => {
    const html = renderToStaticMarkup(
      createElement(SignIn, {
        returnTo: '/account',
        methods: ['email'],
        checkout: 'guest',
        error: 'cancelled',
      }),
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('Sign-in was cancelled')
  })
})

describe('ResendCode', () => {
  it('counts down before a new code can be asked for', () => {
    const html = renderToStaticMarkup(
      createElement(ResendCode, { disabled: false, onResend: vi.fn() }),
    )
    expect(html).toContain('Resend code in 0:30')
  })
})

describe('OrderList', () => {
  it('links each card to its order page with the state, pictures and total', () => {
    const html = renderToStaticMarkup(
      createElement(OrderList, { orders: [order()], timeZone: 'Asia/Kolkata' }),
    )
    expect(html).toContain('href="/account/orders/1042"')
    expect(html).toContain('Order #1042')
    expect(html).toContain('https://cdn.example/b.jpg')
    // Paid needs no second pill.
    expect(html).not.toContain('>Paid<')
  })

  it('says how a cash on delivery order is paid', () => {
    const html = renderToStaticMarkup(
      createElement(OrderList, {
        orders: [order({ payment: 'cod', thumbnails: [], firstImage: null })],
        timeZone: 'Asia/Kolkata',
      }),
    )
    expect(html).toContain('Cash on delivery')
    expect(html).not.toContain('<img')
  })

  it('shows only Cancelled on a cancelled order that was never paid', () => {
    const html = renderToStaticMarkup(
      createElement(OrderList, {
        orders: [order({ status: 'cancelled', payment: 'pending' })],
        timeZone: 'Asia/Kolkata',
      }),
    )
    expect(html).toContain('Cancelled')
    expect(html).not.toContain('Payment pending')
  })

  it('still says a cancelled order was refunded', () => {
    const html = renderToStaticMarkup(
      createElement(OrderList, {
        orders: [order({ status: 'cancelled', payment: 'refunded' })],
        timeZone: 'Asia/Kolkata',
      }),
    )
    expect(html).toContain('Refunded')
  })

  it('offers the shop when there are no orders yet', () => {
    const html = renderToStaticMarkup(
      createElement(OrderList, { orders: [], timeZone: 'Asia/Kolkata' }),
    )
    expect(html).toContain('No orders yet')
    expect(html).toContain('href="/collections"')
  })
})
