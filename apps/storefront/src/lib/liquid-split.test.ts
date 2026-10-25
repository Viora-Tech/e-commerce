import { describe, expect, it } from 'vitest'
import { settlesWithin } from './liquid-split'

describe('settlesWithin', () => {
  it('is true for a promise that settles in time, either way', async () => {
    expect(await settlesWithin(Promise.resolve(1), 20)).toBe(true)
    expect(await settlesWithin(Promise.reject(new Error('x')), 20)).toBe(true)
  })

  it('is false for one that takes longer', async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 200))
    expect(await settlesWithin(slow, 10)).toBe(false)
  })
})
