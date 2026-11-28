/** SOURCE OF TRUTH: tests for ./label-collect.ts — a batch's label files gathered, skips named. */
import { CourierError } from '@commerce/shipping'
import { describe, expect, it } from 'vitest'
import { collectLabelFiles, type LabelRow } from './label-collect'

describe('collectLabelFiles', () => {
  const row = (id: string, labelUrl: string | null = 'https://x/l.pdf'): LabelRow => ({
    id,
    orderNumber: Number(id.slice(1)),
    status: 'created',
    provider: 'shiprocket',
    waybill: id,
    labelUrl,
  })

  it('keeps the order asked, reports a courier that failed, and asks once per id', async () => {
    const asked: string[] = []
    const { files, skipped } = await collectLabelFiles(
      ['s1', 's2', 's3', 's1'],
      [row('s1'), row('s2'), row('s3')],
      async (r) => {
        asked.push(r.id)
        if (r.id === 's2') throw new Error('courier down')
        return new Uint8Array([1])
      },
    )
    expect(files.map((f) => f.id)).toEqual(['s1', 's3'])
    expect(skipped).toEqual([
      {
        shipmentId: 's2',
        orderNumber: 2,
        reason: 'failed',
        courier: 'shiprocket',
        detail: 'courier down',
      },
    ])
    expect(asked.sort()).toEqual(['s1', 's2', 's3'])
  })

  it('never asks for a label the courier has not sent', async () => {
    const { skipped } = await collectLabelFiles(['s1'], [row('s1', null)], async () => {
      throw new Error('should not be asked')
    })
    expect(skipped).toEqual([
      { shipmentId: 's1', orderNumber: 1, reason: 'no_label', courier: 'shiprocket' },
    ])
  })

  const delhivery = (id: string): LabelRow => ({
    ...row(id, '/api/shipments/x/label'),
    provider: 'delhivery',
    courier: 'Delhivery',
  })
  const noLabelYet = (waybill: string) =>
    new CourierError(
      'bad_response',
      'delhivery',
      `Delhivery has no label for ${waybill} yet. Try again in a minute, or print it from Delhivery One.`,
      { detail: { code: 'label_not_ready' } },
    )

  it("maps the courier's 'no label yet' to no_label, keeps its words, and asks once more", async () => {
    let asked = 0
    const { files, skipped } = await collectLabelFiles(
      ['s2503'],
      [delhivery('s2503')],
      async (r) => {
        asked += 1
        throw noLabelYet(r.waybill)
      },
      { retryDelayMs: 1 },
    )
    expect(files).toEqual([])
    expect(asked).toBe(2)
    expect(skipped).toEqual([
      {
        shipmentId: 's2503',
        orderNumber: 2503,
        reason: 'no_label',
        courier: 'Delhivery',
        detail: expect.stringContaining('has no label for s2503 yet'),
      },
    ])
  })

  it('a label that turns up on the retry is printed', async () => {
    let asked = 0
    const { files, skipped } = await collectLabelFiles(
      ['s1'],
      [delhivery('s1')],
      async () => {
        asked += 1
        if (asked === 1) throw new CourierError('timeout', 'delhivery', 'Delhivery did not answer.')
        return new Uint8Array([1])
      },
      { retryDelayMs: 1 },
    )
    expect(asked).toBe(2)
    expect(files.map((f) => f.id)).toEqual(['s1'])
    expect(skipped).toEqual([])
  })

  it('retries a rate-limited or unavailable courier once, never a refusal', async () => {
    const counts: Record<string, number> = {}
    const errors: Record<string, CourierError> = {
      s1: new CourierError('rate_limited', 'delhivery', 'Too many requests'),
      s2: new CourierError('unavailable', 'delhivery', 'Could not reach Delhivery.'),
      s3: new CourierError('rejected', 'delhivery', 'Delhivery refused it.'),
    }
    const { skipped } = await collectLabelFiles(
      ['s1', 's2', 's3'],
      [delhivery('s1'), delhivery('s2'), delhivery('s3')],
      async (r) => {
        counts[r.id] = (counts[r.id] ?? 0) + 1
        throw errors[r.id]
      },
      { retryDelayMs: 1 },
    )
    expect(counts).toEqual({ s1: 2, s2: 2, s3: 1 })
    expect(skipped.map((s) => [s.shipmentId, s.reason])).toEqual([
      ['s1', 'failed'],
      ['s2', 'failed'],
      ['s3', 'failed'],
    ])
    expect(skipped[2]?.detail).toBe('Delhivery refused it.')
  })
})
