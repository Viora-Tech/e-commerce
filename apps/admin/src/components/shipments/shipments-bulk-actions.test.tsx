// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listPickups = vi.fn()
const schedulePickup = vi.fn()
const createManifest = vi.fn()
const manifestSheet = vi.fn()
const returnShipmentToBooked = vi.fn()
vi.mock('@/lib/api-client', () => ({
  api: {
    shipments: { listPickups, schedulePickup, createManifest, manifestSheet },
    orders: { returnShipmentToBooked },
  },
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

describe('ShipmentsBulkActions › Print manifest (To be picked up)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("prints the ticked parcels' manifest in the tab opened on the click", async () => {
    const tab = {
      closed: false,
      location: { href: '' },
      document: { title: '', body: { textContent: '' } },
      close: vi.fn(),
    }
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    URL.createObjectURL = vi.fn(() => 'blob:manifest')
    URL.revokeObjectURL = vi.fn()
    manifestSheet.mockResolvedValue({
      file: new File(['%PDF'], 'manifest.pdf', { type: 'application/pdf' }),
      manifests: 1,
      shipments: 2,
      created: 0,
    })
    render(<ShipmentsBulkActions ids={['s1', 's2']} tab="toPickUp" onDone={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /print manifest/i }))
    await waitFor(() => expect(tab.location.href).toBe('blob:manifest'))
    expect(manifestSheet).toHaveBeenCalledWith({ shipmentIds: ['s1', 's2'] })
    expect(toast.success).toHaveBeenCalledWith('Manifest ready: 2 parcels on 1 pickup.')
  })

  it('is not offered on Booked, where parcels have no pickup yet', () => {
    render(<ShipmentsBulkActions ids={['s1']} tab="booked" onDone={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /print manifest/i })).toBeNull()
  })
})

describe('ShipmentsBulkActions › Cancel pickup (To be picked up, owner 22 Nov 2026)', () => {
  beforeEach(() => vi.clearAllMocks())

  const confirm = async () => {
    fireEvent.click(screen.getByRole('button', { name: /cancel pickup/i }))
    const buttons = await screen.findAllByRole('button', { name: /cancel pickup/i })
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement)
  }

  it('sends every ticked parcel back to Booked, and no Create manifest is offered', async () => {
    returnShipmentToBooked.mockResolvedValue({})
    const onDone = vi.fn()
    render(<ShipmentsBulkActions ids={['s1', 's2']} tab="toPickUp" onDone={onDone} />)
    expect(screen.queryByRole('button', { name: /create manifest/i })).toBeNull()
    await confirm()
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(returnShipmentToBooked).toHaveBeenCalledTimes(2)
    expect(toast.success).toHaveBeenCalledWith('2 parcels are back in Booked.')
  })

  it('says how many could not leave the pickup', async () => {
    returnShipmentToBooked.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('picked'))
    render(<ShipmentsBulkActions ids={['s1', 's2']} tab="toPickUp" onDone={vi.fn()} />)
    await confirm()
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        '1 back in Booked; 1 could not leave the pickup (already collected?).',
      ),
    )
  })
})
