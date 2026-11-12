// @vitest-environment jsdom
import { canNeedApproval, type Permission } from '@commerce/core/permissions'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resourcePermissions } from './role-access'
import RoleEditor, { type EditableRole } from './role-editor'

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }))
const staff = vi.hoisted(() => ({ saveRole: vi.fn(), saveRoleApprovals: vi.fn() }))
const revalidateStaff = vi.hoisted(() => vi.fn())
const access = vi.hoisted(() => ({ isOwner: true }))

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/settings/staff/roles/r1',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/api-client', () => ({ api: { staff } }))
vi.mock('@/app/(admin)/settings/staff/actions', () => ({ revalidateStaff }))
vi.mock('@/hooks/use-permissions', () => ({
  refreshPermissions: vi.fn(),
  usePermissions: () => ({
    member: { isOwner: access.isOwner },
    loading: false,
    hasPermission: () => true,
  }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const orders = resourcePermissions('orders')
const ordersAsk = orders.filter(canNeedApproval)

/** The Administrator role as production had it before the owner's save: every change asks. */
const administrator: EditableRole = {
  id: 'r1',
  name: 'Administrator',
  description: null,
  isSystem: true,
  slug: 'administrator',
  permissions: orders,
  needsApproval: ordersAsk as Permission[],
}

const ordersTable = () => within(screen.getByRole('region', { name: 'Orders' }))

beforeEach(() => {
  router.push.mockReset()
  router.refresh.mockReset()
  staff.saveRole.mockReset().mockResolvedValue({ id: 'r1' })
  staff.saveRoleApprovals.mockReset().mockResolvedValue({ ok: true })
  revalidateStaff.mockReset().mockResolvedValue(undefined)
  access.isOwner = true
})

describe('RoleEditor', { timeout: 20_000 }, () => {
  it('shows one radio row per permission with exactly one level picked', () => {
    render(<RoleEditor initial={administrator} />)
    const groups = ordersTable().getAllByRole('radiogroup')
    expect(groups).toHaveLength(orders.length)
    for (const group of groups) {
      expect(within(group).getAllByRole('radio', { checked: true })).toHaveLength(1)
    }
    // Read can never ask: its row shows "–" under Ask first, so the columns still line up.
    const read = groups.find((g) => within(g).queryByText('Read'))
    expect(read && within(read).getByText('Never asks')).toBeTruthy()
    expect(read && within(read).getAllByRole('radio')).toHaveLength(2)
  })

  it('keeps a built-in role’s grants locked: Off cannot be picked', () => {
    render(<RoleEditor initial={administrator} />)
    for (const off of ordersTable().getAllByRole('radio', { name: 'Off' })) {
      expect((off as HTMLInputElement).disabled).toBe(true)
    }
  })

  it('Allow all, then Save: saves the ticks and drops every cached Staff page (#1623)', async () => {
    const user = userEvent.setup()
    render(<RoleEditor initial={administrator} />)
    await user.click(ordersTable().getByRole('button', { name: 'Allow all' }))
    for (const radio of ordersTable().getAllByRole('radio', { name: 'Allowed' })) {
      expect((radio as HTMLInputElement).checked).toBe(true)
    }
    expect(screen.getByText(`${orders.length} allowed`)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Save role' }))
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/settings/staff?open=roles'))
    // A built-in role's grants are never sent; only the owner's Ask first ticks are.
    expect(staff.saveRole).not.toHaveBeenCalled()
    expect(staff.saveRoleApprovals).toHaveBeenCalledWith({ roleId: 'r1', permissions: [] })
    expect(revalidateStaff).toHaveBeenCalledTimes(1)
    expect(router.refresh).toHaveBeenCalled()
  })

  it('a member who is not the owner cannot change Ask first and has no Save', () => {
    access.isOwner = false
    render(<RoleEditor initial={administrator} />)
    expect(ordersTable().queryByRole('button', { name: 'Allow all' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save role' })).toBeNull()
  })
})
