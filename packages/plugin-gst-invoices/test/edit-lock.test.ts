import { describe, expect, it } from 'vitest'
import { editLockOf, gstr1DueDate } from '../src/edit-invoice'

/** An issued invoice dated 20 Nov 2026 (IST). */
const row = (over: Partial<Parameters<typeof editLockOf>[0]> = {}) => ({
  kind: 'tax_invoice' as const,
  status: 'issued' as const,
  source: 'koomerce' as const,
  reportedPeriod: null,
  invoiceDate: new Date('2026-11-20T06:00:00Z'),
  issuedAt: new Date('2026-11-20T06:00:00Z'),
  snapshot: { einvoice: null },
  ...over,
})
const open = { filed: false, closed: false, credited: false }
/** 11 Dec 2026, 23:00 IST: the last hour of the due date. */
const dueDayLate = new Date('2026-12-11T17:30:00Z')
/** 12 Dec 2026, 00:30 IST. */
const dayAfter = new Date('2026-12-11T19:00:00Z')

describe('editing an issued invoice', () => {
  it('GSTR-1 is due on the 11th of the next month', () => {
    expect(gstr1DueDate('2026-11').toISOString()).toBe('2026-12-10T18:30:00.000Z')
    expect(gstr1DueDate('2026-12').toISOString()).toBe('2027-01-10T18:30:00.000Z')
  })

  it('is allowed until the end of the due date', () => {
    expect(editLockOf(row(), open, dueDayLate)).toMatchObject({
      editable: true,
      reason: null,
      period: '2026-11',
    })
    expect(editLockOf(row(), open, dayAfter)).toMatchObject({
      editable: false,
      reason: 'due_passed',
    })
  })

  it('is locked once the month is marked filed or closed', () => {
    const now = new Date('2026-12-02T06:00:00Z')
    expect(editLockOf(row(), { ...open, filed: true }, now).reason).toBe('filed')
    expect(editLockOf(row({ reportedPeriod: '2026-11' }), open, now).reason).toBe('filed')
    expect(editLockOf(row(), { ...open, closed: true }, now).reason).toBe('closed')
  })

  it('is locked for cancelled, IRN, recorded, credited and other documents', () => {
    const now = new Date('2026-11-25T06:00:00Z')
    expect(editLockOf(row({ status: 'cancelled' }), open, now).reason).toBe('cancelled')
    expect(editLockOf(row({ status: 'draft' }), open, now).reason).toBe('not_issued')
    expect(editLockOf(row({ source: 'external' }), open, now).reason).toBe('external')
    expect(editLockOf(row({ kind: 'credit_note' }), open, now).reason).toBe('not_tax_invoice')
    expect(editLockOf(row({ snapshot: { einvoice: { irn: 'abc' } } }), open, now).reason).toBe(
      'irn',
    )
    expect(editLockOf(row(), { ...open, credited: true }, now).reason).toBe('credited')
  })
})
