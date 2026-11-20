/** SOURCE OF TRUTH: signed-in account sections markup — WHAT: nav, addresses, profile, store credit, your data / WHY: account pages in the checkout's look, with the store credit balance on the account home */
import type { SavedAddress, ShopperStoreCreditEntry, SignedInCustomer } from '@commerce/core'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/account/addresses' }))
vi.mock('@/lib/account-actions', () => ({
  signOutAction: vi.fn(),
  defaultAddressAction: vi.fn(),
  deleteAddressAction: vi.fn(),
  saveAddressAction: vi.fn(),
  saveProfileAction: vi.fn(),
}))
vi.mock('@/lib/privacy-actions', () => ({
  requestDataCopyAction: vi.fn(),
  requestDeletionCodeAction: vi.fn(),
  confirmDeletionAction: vi.fn(),
}))
const { default: AccountNav } = await import('./account-nav')
const { default: AddressBook } = await import('./address-book')
const { checkAddress } = await import('./address-form')
const { default: ProfileForm } = await import('./profile-form')
const { default: StoreCreditSummary } = await import('./store-credit-summary')
const {
  default: StoreCreditHistory,
  describeStoreCredit,
  signedStoreCredit,
} = await import('./store-credit-history')
const { default: DataRequests, requestTone } = await import('./data-requests')

const address = (over: Partial<SavedAddress> = {}): SavedAddress => ({
  id: 'a1',
  name: 'Test Shopper',
  line1: '12 Example Road',
  line2: null,
  city: 'Pune',
  stateCode: 'MH',
  pincode: '411001',
  phone: '9000000000',
  label: null,
  isDefault: false,
  isDefaultBilling: false,
  businessName: null,
  gstin: null,
  ...over,
})

const entry = (over: Partial<ShopperStoreCreditEntry> = {}): ShopperStoreCreditEntry => ({
  id: 'e1',
  amountPaise: 50_000,
  kind: 'refund',
  orderNumber: 1042,
  expiresOn: null,
  createdAt: new Date('2026-10-12T10:00:00Z'),
  ...over,
})

const customer: SignedInCustomer = {
  id: 'c1',
  email: 'shopper@example.com',
  name: 'Test Shopper',
  phone: null,
  acceptsMarketing: true,
  acceptsWhatsapp: false,
  acceptsSms: false,
}

describe('AccountNav', () => {
  it('marks the current section, keeps every row a 2.75rem tap and offers Sign out', () => {
    const html = renderToStaticMarkup(
      createElement(AccountNav, { email: 'shopper@example.com', name: 'Test Shopper' }),
    )
    expect(html).toMatch(/<a aria-current="page"[^>]*href="\/account\/addresses"/)
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html).toContain('href="/account/store-credit"')
    expect(html).toContain('Sign out')
    expect(html).toContain('min-h-11')
    // Pills scroll sideways on a phone, a sidebar from lg.
    expect(html).toContain('overflow-x-auto')
    expect(html).toContain('lg:flex-col')
  })
})

describe('AddressBook', () => {
  it('puts the default address first with its pill and the card actions', () => {
    const html = renderToStaticMarkup(
      createElement(AddressBook, {
        addresses: [address(), address({ id: 'a2', name: 'Home Default', isDefault: true })],
      }),
    )
    expect(html.indexOf('Home Default')).toBeLessThan(html.indexOf('Test Shopper'))
    expect(html).toContain('>Default<')
    // Set as default is offered only on the one that is not.
    expect(html.match(/Set as default/g)).toHaveLength(1)
    expect(html).toContain('Add address')
    expect(html).toContain('Maharashtra 411001')
  })

  it('says there are none yet, with the page title still there', () => {
    const html = renderToStaticMarkup(createElement(AddressBook, { addresses: [] }))
    expect(html).toContain('<h1')
    expect(html).toContain('No saved addresses')
  })
})

describe('checkAddress', () => {
  it('passes a six digit PIN code with a state', () => {
    expect(checkAddress({ pincode: '411001', stateCode: 'MH' })).toBeNull()
  })

  it('names the PIN code and the missing state together', () => {
    expect(checkAddress({ pincode: '41100', stateCode: '' })).toEqual({
      pincode: 'Six digits, for example 110001',
      stateCode: 'Pick your state',
    })
  })
})

describe('ProfileForm', () => {
  it('shows the fixed email, the name field and the offers as switches', () => {
    const html = renderToStaticMarkup(createElement(ProfileForm, { customer }))
    expect(html).toContain('shopper@example.com')
    expect(html).toContain('<label for="profile-name"')
    expect(html.match(/role="switch"/g)).toHaveLength(3)
    expect(html).toContain('motion-safe:animate-[ck-lift')
    expect(html).toContain('motion-reduce:animate-[sf-fade')
  })
})

describe('StoreCreditSummary', () => {
  it('shows the balance with a link to its history', () => {
    const html = renderToStaticMarkup(createElement(StoreCreditSummary, { balancePaise: 75_000 }))
    expect(html).toContain('Store credit to spend')
    expect(html).toContain('750')
    expect(html).toContain('href="/account/store-credit"')
  })

  it('is not drawn with nothing to spend', () => {
    expect(renderToStaticMarkup(createElement(StoreCreditSummary, { balancePaise: 0 }))).toBe('')
  })
})

describe('StoreCreditHistory', () => {
  it('lists each change with its sign and order', () => {
    const html = renderToStaticMarkup(
      createElement(StoreCreditHistory, {
        balancePaise: 30_000,
        entries: [
          entry(),
          entry({ id: 'e2', kind: 'payment', amountPaise: -20_000, orderNumber: 1050 }),
        ],
        timeZone: 'Asia/Kolkata',
      }),
    )
    expect(html).toContain('Refund for order #1042')
    expect(html).toContain('Used on order #1050')
    expect(html).toContain('text-ck-success')
  })

  it('says there is no history yet', () => {
    const html = renderToStaticMarkup(
      createElement(StoreCreditHistory, { balancePaise: 0, entries: [], timeZone: 'UTC' }),
    )
    expect(html).toContain('No store credit yet')
  })

  it('words a change by its kind, never the staff reason', () => {
    expect(describeStoreCredit(entry({ kind: 'expiry', amountPaise: -100 }))).toBe('Expired')
    expect(describeStoreCredit(entry({ kind: 'adjustment', amountPaise: 100 }))).toBe(
      'Added by the store',
    )
    expect(describeStoreCredit(entry({ kind: 'adjustment', amountPaise: -100 }))).toBe(
      'Removed by the store',
    )
  })

  it('signs amounts with a plus or a true minus', () => {
    expect(signedStoreCredit(50_000)).toMatch(/^\+/)
    expect(signedStoreCredit(-50_000)).toMatch(/^−/)
  })
})

describe('DataRequests', () => {
  it('shows each request with its state as a pill', () => {
    const html = renderToStaticMarkup(
      createElement(DataRequests, {
        requests: [
          {
            id: 'r1',
            number: 1,
            kind: 'export',
            status: 'completed',
            createdAt: new Date('2026-10-12T10:00:00Z'),
          },
        ],
        timeZone: 'Asia/Kolkata',
      }),
    )
    expect(html).toContain('Copy of your data')
    expect(html).toContain('>Done<')
  })

  it('tones done good, declined bad and the rest neutral', () => {
    expect(requestTone('completed')).toBe('good')
    expect(requestTone('rejected')).toBe('bad')
    expect(requestTone('open')).toBe('neutral')
    expect(requestTone('in_progress')).toBe('neutral')
  })
})
