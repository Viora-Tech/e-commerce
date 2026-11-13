/** SOURCE OF TRUTH: tests for ./label-collect.ts — a batch's label files gathered, skips named. */
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
    expect(skipped).toEqual([{ shipmentId: 's2', orderNumber: 2, reason: 'failed' }])
    expect(asked.sort()).toEqual(['s1', 's2', 's3'])
  })

  it('never asks for a label the courier has not sent', async () => {
    const { skipped } = await collectLabelFiles(['s1'], [row('s1', null)], async () => {
      throw new Error('should not be asked')
    })
    expect(skipped).toEqual([{ shipmentId: 's1', orderNumber: 1, reason: 'no_label' }])
  })
})
