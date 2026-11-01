import { describe, expect, it } from 'vitest'
import { onePerRequest, requestKey } from '../src/services/ai/assistant/duplicates'
import type { Row } from '../src/services/ai/assistant/views'

/* One request per change: the key folds key order and undefined, never values or list order. */

describe('requestKey', () => {
  const ask = { path: 'discounts.create', input: { code: 'A10', value: 1000, kind: 'code' } }

  it('is the same for the same change in any key order', () => {
    const reordered = { input: { kind: 'code', value: 1000, code: 'A10' }, path: ask.path }
    expect(requestKey('runAdminAction', reordered)).toBe(requestKey('runAdminAction', ask))
    expect(requestKey('runAdminAction', { ...ask, input: { ...ask.input, note: undefined } })).toBe(
      requestKey('runAdminAction', ask),
    )
  })

  it('differs for another value, another list order or another action', () => {
    const key = requestKey('runAdminAction', ask)
    expect(requestKey('runAdminAction', { ...ask, input: { ...ask.input, value: 1001 } })).not.toBe(
      key,
    )
    expect(requestKey('runAdminAction', { ...ask, path: 'discounts.update' })).not.toBe(key)
    expect(requestKey('proposePriceChange', ask)).not.toBe(key)
    expect(requestKey('t', { ids: [1, 2] })).not.toBe(requestKey('t', { ids: [2, 1] }))
  })
})

describe('onePerRequest', () => {
  const row = (id: string, status: Row['status'], raw: unknown) =>
    ({ id, tool: 'runAdminAction', status, input: { raw, resolved: raw } }) as Row

  it('shows each open request once and leaves decided rows alone', () => {
    const rows = [
      row('1', 'proposed', { path: 'x', input: { a: 1, b: 2 } }),
      row('2', 'proposed', { input: { b: 2, a: 1 }, path: 'x' }),
      row('3', 'proposed', { path: 'x', input: { a: 2 } }),
      row('4', 'expired', { path: 'x', input: { a: 1, b: 2 } }),
    ]
    expect(onePerRequest(rows).map((r) => r.id)).toEqual(['1', '3', '4'])
  })
})
