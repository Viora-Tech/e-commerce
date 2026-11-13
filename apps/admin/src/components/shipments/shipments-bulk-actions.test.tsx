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
vi.mock('./use-label-sheet', () => ({
  useLabelSheet: () => ({ format: 'a4', setFormat: vi.fn(), printing: false, print: vi.fn() }),
}))

const { default: ShipmentsBulkActions } = await import('./shipments-bulk-actions')

const REFUSAL = 'Delhivery did not take the pickup request: Pickup time has passed'

describe('ShipmentsBulkActions › Create pickup (Shipments › Booked)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPickups.mockResolvedValue([])
  })

  it('a refused pickup request says why and is not reported as done', async () => {
    schedulePickup.mockResolvedValue([
      { id: 'p1', provider: 'delhivery', status: 'failed', error: REFUSAL },
    ])
    const onDone = vi.fn()
    render(<ShipmentsBulkActions ids={['s1']} tab="booked" onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /create pickup/i }))
    const confirm = (await screen.findByRole('button', {
      name: /schedule pickup/i,
    })) as HTMLButtonElement
    // A day is already picked, so the request can go straight away.
    await waitFor(() => expect(confirm.disabled).toBe(false))
    fireEvent.click(confirm)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(REFUSAL))
    expect(toast.success).not.toHaveBeenCalled()
    expect(createManifest).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })
})
