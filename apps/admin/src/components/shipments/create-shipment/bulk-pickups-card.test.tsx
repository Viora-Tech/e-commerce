// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pickupDays } from './pickup-plan'

const listPickups = vi.fn()
const listPickupOptions = vi.fn()
const schedulePickup = vi.fn()
const createManifest = vi.fn()
vi.mock('@/lib/api-client', () => ({
  api: { shipments: { listPickups, listPickupOptions, schedulePickup, createManifest } },
}))
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('sonner', () => ({ toast }))

const { default: BulkPickupsCard } = await import('./bulk-pickups-card')

const REFUSAL = 'Delhivery did not take the pickup request: Pickup time has passed'

const parcel = (id: string, orderNumber: number) => ({
  shipmentId: id,
  orderId: `o-${id}`,
  orderNumber,
  waybill: `AWB${orderNumber}`,
  customerName: 'Asha',
  city: 'Chennai',
  weightGrams: 500,
  createdAt: new Date('2026-11-25T05:00:00Z'),
  anchor: true,
})

const group = (pickups: unknown[] = []) => ({
  key: 'delhivery|Sonipat',
  providerId: 'delhivery',
  providerLabel: 'Delhivery',
  place: 'Sonipat',
  city: 'Sonipat',
  pincode: '131001',
  parcels: [parcel('s1', 2424), parcel('s2', 2425)],
  pickups,
})

const card = () =>
  render(
    <BulkPickupsCard
      groups={[
        {
          providerId: 'delhivery',
          label: 'Delhivery',
          shipmentIds: ['s1', 's2'],
          grams: 1000,
          canPickup: true,
        },
      ]}
      onLater={vi.fn()}
    />,
  )

describe('BulkPickupsCard (Create shipment › bulk result)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPickups.mockResolvedValue([])
    listPickupOptions.mockResolvedValue({ today: '', groups: [group()] })
    schedulePickup.mockResolvedValue([{ id: 'p1', status: 'scheduled', error: null }])
    createManifest.mockResolvedValue({})
  })

  it('Create pickups asks for the day first instead of booking straight away', async () => {
    card()
    await waitFor(() => expect(listPickups).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /create pickups/i }))
    // The single-order Create pickup drawer: day cards, nothing sent yet.
    expect(await screen.findByText('Pickup day')).toBeTruthy()
    expect(listPickupOptions).toHaveBeenCalledWith({ shipmentIds: ['s1', 's2'] })
    expect(schedulePickup).not.toHaveBeenCalled()
    const tomorrow = pickupDays()[1]?.date ?? ''
    fireEvent.click(screen.getByRole('button', { name: /^Tomorrow/ }))
    fireEvent.click(screen.getByRole('button', { name: /Create pickup · 2 parcels/ }))
    await waitFor(() => expect(schedulePickup).toHaveBeenCalled())
    expect(schedulePickup.mock.calls[0]?.[0]).toMatchObject({
      shipmentIds: ['s1', 's2'],
      date: tomorrow,
    })
    expect(schedulePickup.mock.calls[0]?.[0].joinPickupId).toBeUndefined()
  })

  it('a pickup already booked that day can be joined', async () => {
    const day = pickupDays()[1]?.date ?? ''
    listPickupOptions.mockResolvedValue({
      today: '',
      groups: [
        group([
          {
            id: 'pk1',
            scheduledFor: day,
            timeFrom: '15:00',
            timeTo: null,
            providerRef: 'PU-9',
            parcelCount: 3,
            orderNumbers: [2390],
          },
        ]),
      ],
    })
    card()
    fireEvent.click(screen.getByRole('button', { name: /create pickups/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Add to pickup · 2 parcels/ }))
    await waitFor(() => expect(schedulePickup).toHaveBeenCalled())
    expect(schedulePickup.mock.calls[0]?.[0]).toMatchObject({
      joinPickupId: 'pk1',
      date: day,
      timeFrom: '15:00',
    })
  })

  it('a refused pickup request says why and books no manifest', async () => {
    schedulePickup.mockResolvedValue([
      { id: 'p1', provider: 'delhivery', status: 'failed', error: REFUSAL },
    ])
    card()
    fireEvent.click(screen.getByRole('button', { name: /create pickups/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Create pickup · 2 parcels/ }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(REFUSAL))
    expect(toast.success).not.toHaveBeenCalled()
    expect(createManifest).not.toHaveBeenCalled()
  })
})
