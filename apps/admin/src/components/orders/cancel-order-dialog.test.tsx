// @vitest-environment jsdom
import type { RefundOptions } from '@commerce/core'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CancelOrderDialog from './cancel-order-dialog'
import type { OrderDetail } from './order-detail-types'

const orders = vi.hoisted(() => ({ refundOptions: vi.fn(), cancel: vi.fn() }))
const storeCredit = vi.hoisted(() => ({ getOrderExpiry: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ api: { orders, storeCredit } }))

/* Only the fields the dialog reads: an open, unpacked order paid online. */
const order = {
  id: '00000000-0000-4000-8000-000000000001',
  number: 1042,
  status: 'open',
  paymentStatus: 'paid',
  fulfillmentStatus: 'unfulfilled',
  email: 'asha@example.com',
  importedFrom: null,
  importMeta: null,
  shipment: null,
  lines: [],
} as unknown as OrderDetail

const options: RefundOptions = {
  refundablePaise: 49_900,
  original: true,
  providers: ['razorpay'],
} as RefundOptions

/** A promise the test settles by hand, to look at the dialog while a call is still running. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  let reject: (reason: unknown) => void = () => undefined
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const confirmButton = () => screen.getByRole('button', { name: 'Cancel order' })

beforeEach(() => {
  orders.refundOptions.mockReset().mockResolvedValue(options)
  orders.cancel.mockReset().mockResolvedValue(undefined)
  storeCredit.getOrderExpiry.mockReset().mockResolvedValue({ spentPaise: 0, expiresOn: null })
})

describe('CancelOrderDialog', { timeout: 20_000 }, () => {
  it('holds the refund block in place while its choices load, then shows them', async () => {
    const pending = deferred<RefundOptions>()
    orders.refundOptions.mockReturnValue(pending.promise)
    render(<CancelOrderDialog order={order} onClose={() => undefined} onDone={() => undefined} />)

    expect(screen.getByText('Refund payment')).toBeTruthy()
    expect(screen.queryByRole('radio')).toBeNull()
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true)

    pending.resolve(options)
    await waitFor(() => expect(screen.getAllByRole('radio').length).toBeGreaterThan(0))
    await waitFor(() => expect((confirmButton() as HTMLButtonElement).disabled).toBe(false))
  })

  it('says when the refund choices fail to load, and Try again loads them', async () => {
    const user = userEvent.setup()
    orders.refundOptions.mockRejectedValueOnce(new Error('offline'))
    render(<CancelOrderDialog order={order} onClose={() => undefined} onDone={() => undefined} />)

    expect(await screen.findByText('Could not load how the money can go back.')).toBeTruthy()
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getAllByRole('radio').length).toBeGreaterThan(0))
    expect(orders.refundOptions).toHaveBeenCalledTimes(2)
  })

  it('keeps the dialog busy while the cancel runs, then reports done', async () => {
    const user = userEvent.setup()
    const pending = deferred<undefined>()
    orders.cancel.mockReturnValue(pending.promise)
    const onDone = vi.fn()
    render(<CancelOrderDialog order={order} onClose={() => undefined} onDone={onDone} />)
    await waitFor(() => expect((confirmButton() as HTMLButtonElement).disabled).toBe(false))

    await user.click(confirmButton())
    await waitFor(() => expect(confirmButton().getAttribute('aria-busy')).toBe('true'))
    expect((screen.getByRole('button', { name: 'Keep order' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect(orders.cancel).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: order.id, refund: 'original', notifyCustomer: true }),
    )

    pending.resolve(undefined)
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })
})
