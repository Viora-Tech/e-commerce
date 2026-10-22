import { describe, expect, it } from 'vitest'
import type { GridRow } from './customers-bulk-model'
import { applyToAll } from './customers-bulk-set-all'

const row = (patch: Partial<GridRow> = {}): GridRow => ({
  id: 'a',
  email: 'a@example.com',
  name: 'A',
  phone: '',
  tags: 'vip, demo',
  note: 'Called once',
  acceptsMarketing: 'no',
  acceptsWhatsapp: 'no',
  acceptsSms: 'no',
  anonymised: false,
  ...patch,
})

describe('change for all', () => {
  it('adds, removes and replaces tags without repeats', () => {
    const [added] = applyToAll([row()], { key: 'tags', action: 'addTags', value: 'demo, Diwali' })
    expect(added?.tags).toBe('vip, demo, Diwali')
    const [removed] = applyToAll([row()], { key: 'tags', action: 'removeTags', value: 'VIP' })
    expect(removed?.tags).toBe('demo')
    const [replaced] = applyToAll([row()], { key: 'tags', action: 'replaceTags', value: 'new' })
    expect(replaced?.tags).toBe('new')
  })

  it('appends to, replaces and clears notes', () => {
    const [appended] = applyToAll([row()], { key: 'note', action: 'appendNote', value: 'Sale' })
    expect(appended?.note).toBe('Called once\nSale')
    const [replaced] = applyToAll([row()], { key: 'note', action: 'replaceNote', value: 'New' })
    expect(replaced?.note).toBe('New')
    const [cleared] = applyToAll([row()], { key: 'note', action: 'clearNote', value: '' })
    expect(cleared?.note).toBe('')
  })

  it('skips erased customers, and email marketing for customers without an email', () => {
    const rows = [row(), row({ id: 'b', email: '' }), row({ id: 'c', anonymised: true })]
    const email = applyToAll(rows, { key: 'acceptsMarketing', action: 'subscribe', value: '' })
    expect(email.map((r) => r.acceptsMarketing)).toEqual(['yes', 'no', 'no'])
    const sms = applyToAll(rows, { key: 'acceptsSms', action: 'subscribe', value: '' })
    expect(sms.map((r) => r.acceptsSms)).toEqual(['yes', 'yes', 'no'])
  })
})
