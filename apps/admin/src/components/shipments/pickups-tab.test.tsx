// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listUnpicked = vi.fn()
const listPickups = vi.fn()
const listManifests = vi.fn()
const schedulePickup = vi.fn()
const createManifest = vi.fn()
vi.mock('@/lib/api-client', () => ({
  api: {
    shipments: { listUnpicked, listPickups, listManifests, schedulePickup, createManifest },
  },
}))
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('sonner', () => ({ toast }))

const { default: PickupsTab } = await import('./pickups-tab')

const REFUSAL = 'Delhivery did not take the pickup request: Pickup time has passed'

const parcel = { id: '11111111-1111-4111-8111-111111111111', provider: 'delhivery', waybill: 'WB1' }
const failedRow = {
  id: '22222222-2222-4222-8222-222222222222',
  provider: 'delhivery',
  scheduledFor: '2099-01-01',
  timeFrom: '14:00',
  timeTo: null,
  expectedPackageCount: 1,
  status: 'failed',
  providerRef: null,
  error: REFUSAL,
}

describe('PickupsTab (Shipments › Pickups, Delhivery › Pickups)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listUnpicked.mockResolvedValue([parcel])
    listPickups.mockResolvedValue([])
    listManifests.mockResolvedValue([])
  })

  it('says the courier refused, in its words, instead of a success toast', async () => {
    schedulePickup.mockResolvedValue([failedRow])
    render(<PickupsTab provider="delhivery" />)
    fireEvent.click(await screen.findByRole('checkbox'))
    const submit = screen.getByRole('button', { name: /schedule pickup/i }) as HTMLButtonElement
    // A day is already picked (today, or tomorrow from noon), so ticking a parcel is enough.
    await waitFor(() => expect(submit.disabled).toBe(false))
    fireEvent.click(submit)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(REFUSAL))
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('shows why a failed pickup failed in the list', async () => {
    listPickups.mockResolvedValue([failedRow])
    render(<PickupsTab provider="delhivery" />)
    expect(await screen.findByText(REFUSAL)).toBeTruthy()
  })
})
