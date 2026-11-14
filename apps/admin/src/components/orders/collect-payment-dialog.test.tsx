// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CollectPaymentDialog from './collect-payment-dialog'
import type { OrderDetail } from './order-detail-types'

const orders = vi.hoisted(() => ({ collectPayment: vi.fn() }))
const storeCredit = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ api: { orders, storeCredit } }))

/* Only the fields the dialog reads: a cash on delivery order with no customer account. */
const order = {
  id: '00000000-0000-4000-8000-000000000001',
  number: 1042,
  paymentMethod: 'cod',
  customer: null,
} as unknown as OrderDetail

const amountField = () => screen.getByLabelText('Amount (₹)') as HTMLInputElement
const markPaid = () => screen.getByRole('button', { name: 'Mark as paid' }) as HTMLButtonElement

function renderDialog(onClose = vi.fn(), onDone = vi.fn()) {
  render(
    <CollectPaymentDialog
      order={order}
      balancePaise={49_900}
      gateway={false}
      payHref="/orders/x"
      onClose={onClose}
      onDone={onDone}
    />,
  )
  return { onClose, onDone }
}

beforeEach(() => {
  orders.collectPayment.mockReset().mockResolvedValue(undefined)
  storeCredit.get.mockReset().mockResolvedValue({ balancePaise: 0 })
})

describe('CollectPaymentDialog', { timeout: 20_000 }, () => {
  it('closes on Esc when nothing was changed', async () => {
    const { onClose } = renderDialog()
    expect(amountField().value).toBe('499')
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('asks before dropping a changed amount on Esc', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    await user.clear(amountField())
    await user.type(amountField(), '200')
    await user.keyboard('{Escape}')
    expect(await screen.findByText('Discard what you typed?')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('stays open and busy while the payment is recorded', async () => {
    const user = userEvent.setup()
    let finish: () => void = () => undefined
    orders.collectPayment.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    const { onClose, onDone } = renderDialog()
    await user.click(markPaid())
    await waitFor(() => expect(markPaid().getAttribute('aria-busy')).toBe('true'))
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    expect(orders.collectPayment).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: order.id, amountPaise: 49_900, paidWith: 'cash' }),
    )
    finish()
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })
})
