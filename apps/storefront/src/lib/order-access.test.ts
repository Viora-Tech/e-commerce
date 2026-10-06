import { orderViewToken } from '@commerce/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Security audit 2026-10-06 (A-00, found on the paused 2026-09-28 branch and still on dev):
 * "Retry payment", "Pay balance" and "New QR" took only the order number and redirected to
 * the thank-you page with a freshly minted view token, so anyone could open any order
 * (name, address, phone, items) by its sequential number.
 */

const SECRET = 'test-settings-secret-0123456789'
const ORDER = { id: '01a0def6-0000-7000-8000-000000000001', customerId: 'cust-owner' }

const state = vi.hoisted(() => ({
  customer: null as { id: string } | null,
  limited: false,
  checked: 0,
  redirects: [] as string[],
}))

vi.mock('@commerce/config', async (orig) => ({
  ...(await orig<typeof import('@commerce/config')>()),
  settingsSecret: () => SECRET,
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-store-id': 'store-1' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    state.redirects.push(to)
    throw new Error(`redirect:${to}`)
  },
}))
vi.mock('./customer-session', () => ({ currentCustomer: async () => state.customer }))
vi.mock('./store-context', () => ({
  // The order lookup answers with the one order; nothing else reaches the database.
  inStore: async (_storeId: string, fn: (tx: unknown) => Promise<unknown>) =>
    fn({ select: () => ({ from: () => ({ where: async () => [ORDER] }) }) }),
}))
vi.mock('./cart-cookie', () => ({ readCartId: async () => 'cart-1' }))
vi.mock('./rate-limit', () => ({
  clientIp: () => '203.0.113.9',
  rateLimited: async () => ({ ok: !state.limited }),
}))
vi.mock('@commerce/core', async (orig) => ({
  ...(await orig<typeof import('@commerce/core')>()),
  checkDiscountCode: async () => {
    state.checked += 1
    return { ok: false, reason: 'invalid' }
  },
}))

vi.mock('./shipping', () => ({
  estimateForPincode: async () => {
    state.checked += 1
    return { ok: true, serviceable: false, pincode: '110001', reason: 'x' }
  },
  checkoutShipping: async () => null,
}))

const { accessibleOrderId } = await import('./order-access')
const { estimateDeliveryAction } = await import('./shipping-actions')
const { payBalanceAction } = await import('./balance-actions')
const { applyDiscountAction } = await import('./discount-actions')

beforeEach(() => {
  state.customer = null
  state.limited = false
  state.checked = 0
  state.redirects = []
})

describe('accessibleOrderId', () => {
  it('opens an order to its owner or a token for it, never to its number alone', async () => {
    expect(await accessibleOrderId('store-1', 7, null)).toBeNull()
    expect(await accessibleOrderId('store-1', 7, 'forged')).toBeNull()
    expect(await accessibleOrderId('store-1', 7, orderViewToken('other-order', SECRET))).toBeNull()
    expect(await accessibleOrderId('store-1', 7, orderViewToken(ORDER.id, SECRET))).toBe(ORDER.id)
    state.customer = { id: 'someone-else' }
    expect(await accessibleOrderId('store-1', 7, null)).toBeNull()
    state.customer = { id: 'cust-owner' }
    expect(await accessibleOrderId('store-1', 7, null)).toBe(ORDER.id)
  })
})

describe('payBalanceAction', () => {
  it('sends a stranger to the untokened page, never a fresh view token', async () => {
    await expect(payBalanceAction(7, null)).rejects.toThrow(/redirect/)
    expect(state.redirects).toEqual(['/checkout/thank-you/7'])
  })
})

describe('estimateDeliveryAction', () => {
  it("stops asking the courier once an IP is over its limit (the store's courier quota)", async () => {
    state.limited = true
    expect((await estimateDeliveryAction('110001')).ok).toBe(false)
    expect(state.checked).toBe(0)
  })
})

describe('applyDiscountAction', () => {
  it('stops checking codes once the IP or cart is over its limit', async () => {
    state.limited = true
    expect(await applyDiscountAction('GUESS1')).toEqual({ ok: false, reason: 'invalid' })
    expect(state.checked).toBe(0)
    state.limited = false
    await applyDiscountAction('GUESS2')
    expect(state.checked).toBe(1)
  })
})
