import type { CustomerSheetRow } from '@commerce/api'
import { describe, expect, it } from 'vitest'
import { customersBulkEditContent } from '@/data/customers-bulk-edit'
import {
  applyPaste,
  detailPayload,
  dirtyCount,
  type GridRow,
  toGridRow,
  validateRows,
} from './customers-bulk-model'

const sheetRow = (n: number, patch: Partial<CustomerSheetRow> = {}): CustomerSheetRow => ({
  id: `00000000-0000-4000-8000-00000000010${n}`,
  email: `c${n}@example.com`,
  name: `Customer ${n}`,
  phone: '',
  tags: ['vip'],
  note: '',
  acceptsMarketing: false,
  acceptsWhatsapp: false,
  acceptsSms: false,
  anonymised: false,
  ...patch,
})

const baseOf = (rows: GridRow[]) => new Map(rows.map((r) => [r.id, r]))

describe('customers bulk-edit model', () => {
  it('pastes across columns from the active cell, reading consent as yes or no', () => {
    const rows = [toGridRow(sheetRow(1)), toGridRow(sheetRow(2))]
    // From Name: name, phone, tags, note, email marketing.
    const next = applyPaste(rows, { rowIdx: 0, colIdx: 1 }, 'Asha\t98765\tvip, b2b\t\tYes\nRavi')
    expect(next[0]).toMatchObject({
      name: 'Asha',
      phone: '98765',
      tags: 'vip, b2b',
      acceptsMarketing: 'yes',
    })
    expect(next[1]?.name).toBe('Ravi')
    expect(dirtyCount(next, baseOf(rows))).toBe(5)
  })

  it('leaves erased customers alone and keeps unknown consent text out', () => {
    const rows = [toGridRow(sheetRow(1, { anonymised: true })), toGridRow(sheetRow(2))]
    const next = applyPaste(rows, { rowIdx: 0, colIdx: 5 }, 'yes\nmaybe')
    expect(next[0]?.acceptsMarketing).toBe('no')
    expect(next[1]?.acceptsMarketing).toBe('no')
  })

  it('sends only changed details, and validates only changed cells', () => {
    const base = toGridRow(sheetRow(1, { name: 'x'.repeat(250) }))
    const row = { ...base, tags: 'vip, wholesale', note: '  ' }
    expect(detailPayload(row, base)).toEqual({ tags: ['vip', 'wholesale'] })
    expect(validateRows([row], baseOf([base]), customersBulkEditContent.validation).size).toBe(0)
    const tooMany = { ...base, tags: Array.from({ length: 51 }, (_, i) => `t${i}`).join(',') }
    expect([
      ...validateRows([tooMany], baseOf([base]), customersBulkEditContent.validation).values(),
    ]).toEqual([customersBulkEditContent.validation.tagCount])
  })
})
