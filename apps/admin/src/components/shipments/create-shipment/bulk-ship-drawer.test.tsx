// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DraftOrder, ShipmentDraft } from './flow-state'

const prepare = vi.fn()
const quote = vi.fn()
const wallets = vi.fn()
vi.mock('@/lib/api-client', () => ({
  api: {
    shipments: { prepare, quote, wallets, bulkBook: vi.fn() },
    orders: { requestOnlinePayment: vi.fn() },
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const { default: BulkShipDrawer } = await import('./bulk-ship-drawer')

const order = (id: string, orderNumber: number): DraftOrder => ({
  orderId: id,
  orderNumber,
  customerName: 'Riya Sharma',
  city: 'Bengaluru',
  pincode: '560038',
  line1: null,
  line2: null,
  stateCode: 'KA',
  phone: null,
  paymentStatus: 'paid',
  fulfillmentStatus: 'unfulfilled',
  paymentMode: 'prepaid',
  totalPaise: 249900,
  blocked: null,
  parcels: [
    {
      id: `p-${id}`,
      position: 1,
      locationName: null,
      lines: [
        {
          id: `l-${id}`,
          title: 'Glasspad',
          quantity: 1,
          imageUrl: null,
          sku: null,
          unitPricePaise: 249900,
          weightGrams: 300,
          availability: { inStock: 1, preorder: null, restockOn: null },
        },
      ],
      valuePaise: 249900,
      weightGrams: 820,
      dimensionsCm: { length: 48, width: 42, height: 4 },
      pickupLocationId: null,
      boxName: 'Glasspad box',
    },
  ],
  unitsOrdered: 1,
  deliveryChoice: null,
  payOnlineRequestedAt: null,
})

const draft: ShipmentDraft = {
  couriers: [{ id: 'delhivery', label: 'Delhivery', hasRates: true, hasPickup: true }],
  boxes: [],
  defaultBoxId: null,
  pickupPlaces: [],
  orders: [order('a', 1042), order('b', 1043)],
  insureByDefault: false,
}

const answer = (orderId: string) => ({
  orderId,
  fulfillmentOrderId: `p-${orderId}`,
  chargedWeightGrams: 1000,
  originPincode: '122001',
  checkout: null,
  options: [
    {
      optionKey: 'delhivery',
      providerId: 'delhivery',
      providerName: 'delhivery',
      providerLabel: 'Delhivery',
      serviceId: null,
      charges: [],
      chargeableWeightGrams: 1000,
      pricePaise: 12550,
      minTransitDays: null,
      maxTransitDays: null,
      codAvailable: null,
      problem: null,
      problemDetail: null,
      deliveryBy: null,
      etaFromSettings: false,
      badges: ['recommended'],
      insurance: null,
    },
  ],
})

const open = async () => {
  render(<BulkShipDrawer orderIds={['a', 'b']} onClose={vi.fn()} onBooked={vi.fn()} />)
  await screen.findAllByText('Delhivery', { selector: 'span' })
}

const editButton = (n: number) => screen.getByRole('button', { name: `Edit order #${n}` })
const editor = () => screen.getByRole('group', { name: /Edit shipment/ })
const weightField = () => screen.getByRole('textbox', { name: 'Weight in grams' })

describe('BulkShipDrawer: editing a row in place', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prepare.mockResolvedValue(draft)
    wallets.mockResolvedValue([])
    quote.mockImplementation(({ parcels }: { parcels: { orderId: string }[] }) =>
      Promise.resolve(parcels.map((p) => answer(p.orderId))),
    )
  })

  it('opens the editor under the row, with no dialog', async () => {
    await open()
    fireEvent.click(editButton(1042))
    const editor = screen.getByRole('group', { name: 'Edit shipment · #1042' })
    expect(editor.closest('tr')).toBeTruthy()
    expect(editButton(1042).getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByRole('dialog', { name: /Edit shipment/ })).toBeNull()
    expect(within(editor).getByRole('button', { name: 'Apply' })).toBeTruthy()
    expect(within(editor).getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })

  it('opens from a click on the row itself', async () => {
    await open()
    fireEvent.click(screen.getByText('#1043'))
    expect(screen.getByRole('group', { name: 'Edit shipment · #1043' })).toBeTruthy()
  })

  it('keeps only one row open at a time', async () => {
    await open()
    fireEvent.click(editButton(1042))
    fireEvent.click(editButton(1043))
    expect(screen.queryByRole('group', { name: 'Edit shipment · #1042' })).toBeNull()
    expect(screen.getByRole('group', { name: 'Edit shipment · #1043' })).toBeTruthy()
    expect(screen.getAllByRole('group', { name: /Edit shipment/ })).toHaveLength(1)
  })

  it('Apply updates the row and asks that order’s couriers again', async () => {
    await open()
    expect(quote).toHaveBeenCalledTimes(1)
    fireEvent.click(editButton(1042))
    fireEvent.change(weightField(), { target: { value: '900' } })
    fireEvent.click(within(editor()).getByRole('button', { name: 'Apply' }))
    expect(screen.queryByRole('group', { name: /Edit shipment/ })).toBeNull()
    await waitFor(() => expect(quote).toHaveBeenCalledTimes(2))
    const [{ parcels }] = quote.mock.calls[1] as [{ parcels: { orderId: string }[] }]
    expect(parcels).toEqual([expect.objectContaining({ orderId: 'a', weightGrams: 900 })])
    // Reopened, the editor starts from the applied weight.
    fireEvent.click(editButton(1042))
    expect((weightField() as HTMLInputElement).value).toBe('900')
  })

  it('Cancel closes the editor and changes nothing', async () => {
    await open()
    fireEvent.click(editButton(1042))
    fireEvent.change(weightField(), { target: { value: '900' } })
    fireEvent.click(within(editor()).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('group', { name: /Edit shipment/ })).toBeNull()
    expect(quote).toHaveBeenCalledTimes(1)
    fireEvent.click(editButton(1042))
    expect((weightField() as HTMLInputElement).value).toBe('820')
  })

  it('Esc cancels the edit and keeps the drawer open', async () => {
    const onClose = vi.fn()
    render(<BulkShipDrawer orderIds={['a', 'b']} onClose={onClose} onBooked={vi.fn()} />)
    await screen.findAllByText('Delhivery', { selector: 'span' })
    fireEvent.click(editButton(1042))
    fireEvent.change(weightField(), { target: { value: '900' } })
    fireEvent.keyDown(weightField(), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('group', { name: /Edit shipment/ })).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
    expect(quote).toHaveBeenCalledTimes(1)
    fireEvent.click(editButton(1042))
    expect((weightField() as HTMLInputElement).value).toBe('820')
  })
})
