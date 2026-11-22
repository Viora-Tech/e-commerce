// @vitest-environment jsdom
import { permissions } from '@commerce/core/permissions'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { customerSignInAsContent } from '@/data/customer-sign-in-as'
import { useSignInAsCustomer } from './use-sign-in-as-customer'

const held = { list: [] as string[] }

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({
    member: null,
    loading: false,
    hasPermission: (p: string) => held.list.includes(p),
  }),
}))

describe('Sign in as customer menu item', () => {
  beforeEach(() => {
    held.list = []
  })

  it('is hidden without customers.sign_in_as', () => {
    held.list = [permissions.CUSTOMERS_READ, permissions.CUSTOMERS_WRITE]
    const { result } = renderHook(() => useSignInAsCustomer())
    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0]?.hidden).toBe(true)
  })

  it('shows with the permission and opens the confirm', () => {
    held.list = [permissions.CUSTOMERS_SIGN_IN_AS]
    const { result } = renderHook(() => useSignInAsCustomer())
    const item = result.current.items[0]
    expect(item?.hidden).toBe(false)
    expect(item?.label).toBe(customerSignInAsContent.menu)
    act(() => item?.onSelect?.())
    expect(result.current.open).toBe(true)
  })
})
