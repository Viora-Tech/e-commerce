import type { CustomerSheetRow } from '@commerce/api'
import { describe, expect, it } from 'vitest'
import { customersBulkEditContent } from '@/data/customers-bulk-edit'
import {
  addressPayload,
  applyPaste,
  canEdit,
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
  gstin: '',
  businessName: '',
  defaultAddress: null,
  anonymised: false,
  ...patch,
})

const home = {
  id: '00000000-0000-4000-8000-000000000201',
  name: 'Asha',
  line1: '12 MG Road',
  line2: null,
  city: 'Bengaluru',
  stateCode: 'KA',
  pincode: '560001',
  phone: '9876543210',
}

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

  it('checks a changed GSTIN like checkout and sends it upper case', () => {
    const base = toGridRow(sheetRow(1))
    const copy = customersBulkEditContent.validation
    const typo = { ...base, gstin: '29AABCT3518Q1ZV' }
    expect([...validateRows([typo], baseOf([base]), copy).values()]).toEqual([copy.gstin.checksum])
    const good = { ...base, gstin: '29aabct3518q1zs', businessName: ' Asha Traders ' }
    expect(validateRows([good], baseOf([base]), copy).size).toBe(0)
    expect(detailPayload(good, base)).toEqual({
      gstin: '29AABCT3518Q1ZS',
      businessName: 'Asha Traders',
    })
  })

  it('edits the default address city, state and PIN, and locks them without one', () => {
    const none = toGridRow(sheetRow(1))
    expect(canEdit(none, 'city')).toBe(false)
    expect(applyPaste([none], { rowIdx: 0, colIdx: 10 }, 'Pune\tMH\t411001')[0]?.city).toBe('')

    const base = toGridRow(sheetRow(2, { defaultAddress: home }))
    expect(base).toMatchObject({ city: 'Bengaluru', stateCode: 'KA', pincode: '560001' })
    const copy = customersBulkEditContent.validation
    const moved = applyPaste([base], { rowIdx: 0, colIdx: 10 }, 'Pune\tMaharashtra\t411001')[0]
    if (!moved) throw new Error('paste')
    expect(validateRows([moved], baseOf([base]), copy).size).toBe(0)
    expect(addressPayload(moved, base)).toEqual({
      customerId: base.id,
      addressId: home.id,
      address: {
        name: 'Asha',
        line1: '12 MG Road',
        city: 'Pune',
        stateCode: 'MH',
        pincode: '411001',
        phone: '9876543210',
      },
    })
    expect(addressPayload(base, base)).toBeNull()
    const bad = { ...base, stateCode: 'Narnia', pincode: '012345' }
    expect([...validateRows([bad], baseOf([base]), copy).values()]).toEqual([
      copy.stateCode,
      copy.pincode,
    ])
  })
})
