/** SOURCE OF TRUTH: signup gate ownership tests — only owning a store (not staff membership) skips the invite-only gate */
import { describe, expect, it } from 'vitest'
import { isOwnerRole } from './signup-gate'

describe('isOwnerRole', () => {
  it('counts only the owner role, alone or among others', () => {
    expect(isOwnerRole('owner')).toBe(true)
    expect(isOwnerRole('admin,owner')).toBe(true)
    expect(isOwnerRole('member')).toBe(false)
    expect(isOwnerRole('admin')).toBe(false)
    expect(isOwnerRole('co-owner')).toBe(false)
  })
})
