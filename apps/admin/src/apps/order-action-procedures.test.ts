import { beforeEach, describe, expect, it, vi } from 'vitest'
import { orderAppActionsContent } from '@/data/order-app-actions'

type AddAnswer = { added: number; skipped: number; alreadyQueued: number; alreadyInvoiced: number }
const add = vi.fn<(input: { orderIds: string[] }) => Promise<AddAnswer>>()

vi.mock('@/lib/api-client', () => ({ api: { gstInvoices: { queue: { add } } } }))
vi.mock('@/components/apps/gst-invoices/save-file', () => ({ saveFile: vi.fn() }))

const { ORDER_ACTION_PROCEDURES } = await import('./order-action-procedures')
const queueAdd = ORDER_ACTION_PROCEDURES['gst-invoices/queue-add']

beforeEach(() => {
  add.mockReset()
  vi.stubGlobal('window', { dispatchEvent: () => true })
})

describe('bulk Add to invoice queue', () => {
  it('accounts for every selected order, not only the new invoices', async () => {
    // 12 orders: 2 new invoices, 7 already queued at payment, 2 already issued, 1 test order.
    add.mockResolvedValue({ added: 2, skipped: 1, alreadyQueued: 7, alreadyInvoiced: 2 })
    const ids = Array.from({ length: 12 }, (_, i) => `o${i}`)
    const r = await queueAdd?.(ids, orderAppActionsContent)
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ orderIds: ids }))
    expect(r?.message).toBe(
      'Added 2 invoices to the invoice queue. 7 orders already in the queue. 2 orders already invoiced. Skipped 1 order: test, cancelled and gift-card-only orders get no tax invoice.',
    )
    expect(r?.action?.label).toBe(orderAppActionsContent.gst.openQueue)
  })

  it('sends a large selection in batches and adds the counts up', async () => {
    add.mockResolvedValue({ added: 1, skipped: 0, alreadyQueued: 99, alreadyInvoiced: 0 })
    const ids = Array.from({ length: 250 }, (_, i) => `o${i}`)
    const r = await queueAdd?.(ids, orderAppActionsContent)
    expect(add).toHaveBeenCalledTimes(3)
    expect(r?.message).toBe(
      'Added 3 invoices to the invoice queue. 297 orders already in the queue.',
    )
  })
})
