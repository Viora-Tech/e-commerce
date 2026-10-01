import { describe, expect, it } from 'vitest'
import { lockedOut } from './lock-gate'

describe('lockedOut', () => {
  it('shuts out a visitor without a pass while the store is locked', () => {
    expect(lockedOut({ enabled: true }, { access: false, preview: false })).toBe(true)
  })

  it('lets a pass holder, a previewing merchant, or anyone on an open store through', () => {
    expect(lockedOut({ enabled: true }, { access: true, preview: false })).toBe(false)
    expect(lockedOut({ enabled: true }, { access: false, preview: true })).toBe(false)
    expect(lockedOut({ enabled: false }, { access: false, preview: false })).toBe(false)
  })
})
