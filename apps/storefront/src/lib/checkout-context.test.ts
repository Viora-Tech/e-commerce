import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./checkout-session', () => ({ readCheckoutSession: vi.fn() }))
vi.mock('./cart-cookie', () => ({ readCartId: vi.fn() }))
vi.mock('next/headers', () => ({ headers: vi.fn() }))

import { headers } from 'next/headers'
import { readCartId } from './cart-cookie'
import { checkoutCartId, checkoutContext } from './checkout-context'
import { readCheckoutSession } from './checkout-session'

const session = vi.mocked(readCheckoutSession)
const cookie = vi.mocked(readCartId)
const hdrs = vi.mocked(headers)

const headerStore = (storeId: string | null) =>
  hdrs.mockResolvedValue({ get: (k: string) => (k === 'x-store-id' ? storeId : null) } as never)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('checkoutContext', () => {
  it('uses the checkout session when present (checkout origin)', async () => {
    session.mockResolvedValue({ storeId: 's1', cartId: 'c1', customerId: null })
    expect(await checkoutContext()).toEqual({ storeId: 's1', cartId: 'c1' })
  })

  it('falls back to the proxy header store and cart cookie (store origin)', async () => {
    session.mockResolvedValue(null)
    headerStore('s2')
    cookie.mockResolvedValue('c2')
    expect(await checkoutContext()).toEqual({ storeId: 's2', cartId: 'c2' })
  })

  it('is null when there is neither a session nor a cart', async () => {
    session.mockResolvedValue(null)
    headerStore('s3')
    cookie.mockResolvedValue(null)
    expect(await checkoutContext()).toBeNull()
  })
})

describe('checkoutCartId', () => {
  it('prefers the session cart, else the cookie', async () => {
    session.mockResolvedValue({ storeId: 's', cartId: 'from-session', customerId: null })
    cookie.mockResolvedValue('from-cookie')
    expect(await checkoutCartId()).toBe('from-session')

    session.mockResolvedValue(null)
    expect(await checkoutCartId()).toBe('from-cookie')
  })
})
