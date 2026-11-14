// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listPickups = vi.fn()
const schedulePickup = vi.fn()
const createManifest = vi.fn()
vi.mock('@/lib/api-client', () => ({
  api: { shipments: { listPickups, schedulePickup, createManifest } },
}))
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('sonner', () => ({ toast }))

const { default: BulkPickupsCard } = await import('./bulk-pickups-card')

const REFUSAL = 'Delhivery did not take the pickup request: Pickup time has passed'

describe('BulkPickupsCard (Create shipment › bulk result)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPickups.mockResolvedValue([])
  })

  it('a refused pickup request says why instead of "Pickups created"', async () => {
    schedulePickup.mockResolvedValue([
      { id: 'p1', provider: 'delhivery', status: 'failed', error: REFUSAL },
    ])
    render(
      <BulkPickupsCard
        groups={[
          {
            providerId: 'delhivery',
            label: 'Delhivery',
            shipmentIds: ['s1'],
            grams: 500,
            canPickup: true,
          },
        ]}
        onLater={vi.fn()}
      />,
    )
    await waitFor(() => expect(listPickups).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /create pickups/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(REFUSAL))
    expect(toast.success).not.toHaveBeenCalled()
    expect(createManifest).not.toHaveBeenCalled()
  })
})
