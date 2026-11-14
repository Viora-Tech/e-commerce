// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pickupDays } from './pickup-plan'

const listPickupOptions = vi.fn()
const schedulePickup = vi.fn()
const createManifest = vi.fn()
vi.mock('@/lib/api-client', () => ({
  api: { shipments: { listPickupOptions, schedulePickup, createManifest } },
}))
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('sonner', () => ({ toast }))

const { default: PickupDrawer } = await import('./pickup-drawer')

const parcel = (id: string, orderNumber: number, anchor: boolean) => ({
  shipmentId: id,
  orderId: `o-${id}`,
  orderNumber,
  waybill: `AWB${orderNumber}`,
  customerName: 'Asha',
  city: 'Chennai',
  weightGrams: 500,
  createdAt: new Date('2026-11-14T05:00:00Z'),
  anchor,
})

const group = (pickups: unknown[] = []) => ({
  key: 'delhivery|Sonipat',
  providerId: 'delhivery',
  providerLabel: 'Delhivery',
  place: 'Sonipat',
  city: 'Sonipat',
  pincode: '131001',
  // The server also lists the courier's other booked parcels; the drawer must not.
  parcels: [parcel('s1', 2424, true), parcel('s2', 2401, false), parcel('s3', 2399, false)],
  pickups,
})

const open = () =>
  render(<PickupDrawer open onOpenChange={vi.fn()} shipmentIds={['s1']} onDone={vi.fn()} />)

describe('PickupDrawer (after booking one parcel)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    schedulePickup.mockResolvedValue([{ id: 'p1', status: 'scheduled' }])
    createManifest.mockResolvedValue({})
  })

  it('shows only the parcel just booked, with no tick boxes for the others', async () => {
    listPickupOptions.mockResolvedValue({ today: '', groups: [group()] })
    open()
    expect(await screen.findByText('#2424 · AWB AWB2424')).toBeTruthy()
    expect(screen.getByText('This parcel')).toBeTruthy()
    expect(screen.queryByText(/#2401/)).toBeNull()
    expect(screen.queryByText(/#2399/)).toBeNull()
    expect(screen.queryByText(/waiting in Booked/)).toBeNull()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Later' })).toBeTruthy()
  })

  it('books the pickup for that parcel alone', async () => {
    listPickupOptions.mockResolvedValue({ today: '', groups: [group()] })
    open()
    fireEvent.click(await screen.findByRole('button', { name: /Create pickup · 1 parcel/ }))
    await waitFor(() => expect(schedulePickup).toHaveBeenCalled())
    expect(schedulePickup.mock.calls[0]?.[0].shipmentIds).toEqual(['s1'])
  })

  it('joining an open pickup keeps its one-line summary but lists no other orders', async () => {
    const day = pickupDays()[1]?.date ?? ''
    listPickupOptions.mockResolvedValue({
      today: '',
      groups: [
        group([
          {
            id: 'pk1',
            scheduledFor: day,
            timeFrom: '14:00',
            timeTo: null,
            providerRef: 'PU-9',
            parcelCount: 3,
            orderNumbers: [2390, 2391, 2392],
          },
        ]),
      ],
    })
    open()
    expect(await screen.findByText(/Delhivery is already coming/)).toBeTruthy()
    expect(screen.queryByText(/Already in it/)).toBeNull()
    expect(screen.queryByText(/#2390/)).toBeNull()
    expect(screen.getByRole('button', { name: /Add to pickup · 1 parcel/ })).toBeTruthy()
  })
})
