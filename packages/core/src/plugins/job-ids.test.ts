import { describe, expect, it } from 'vitest'
import { notificationJobId } from '../notifications/enqueue'
import { appEventJobId } from './events'

// BullMQ throws "Custom Id cannot contain :" for an id with ':' unless it splits into
// exactly three parts; a refused id means the outbox event never reaches its queue.
const bullmqAccepts = (id: string) => !id.includes(':') || id.split(':').length === 3

const STORE = '259813c5-2ef9-0198-7fd0-e760f4273725'
const ORDER = '01a134be-8765-7038-8c41-08a2179577bb'

describe('queue job ids', () => {
  it('notification ids keep three parts with or without a key', () => {
    const base = { storeId: STORE, orderId: ORDER, template: 'order_paid' } as const
    expect(bullmqAccepts(notificationJobId(base as never))).toBe(true)
    expect(bullmqAccepts(notificationJobId({ ...base, key: ORDER } as never))).toBe(true)
    expect(bullmqAccepts(notificationJobId({ ...base, orderId: '', key: ORDER } as never))).toBe(
      true,
    )
  })

  it('app event ids keep three parts with or without an app', () => {
    const base = { storeId: STORE, event: 'order.paid', orderId: ORDER } as const
    expect(bullmqAccepts(appEventJobId(base as never))).toBe(true)
    expect(bullmqAccepts(appEventJobId({ ...base, pluginId: 'gst-invoices' } as never))).toBe(true)
    expect(
      bullmqAccepts(appEventJobId({ ...base, refundId: ORDER, pluginId: 'reviews' } as never)),
    ).toBe(true)
  })

  it('a key or app still tells two jobs apart', () => {
    const base = { storeId: STORE, orderId: ORDER, template: 'review_request' } as const
    expect(notificationJobId({ ...base, key: 'a' } as never)).not.toBe(
      notificationJobId({ ...base, key: 'b' } as never),
    )
  })
})
