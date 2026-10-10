import { describe, expect, it } from 'vitest'
import { readStored, storageKey } from '../src/storage-keys'

const storage = (entries: Record<string, string>) => ({
  getItem: (key: string) => entries[key] ?? null,
})

describe('Zero Drift storage keys', () => {
  it('names new entries under zero-drift:', () => {
    expect(storageKey('subscribed')).toBe('zero-drift:subscribed')
    expect(storageKey('popup:footer-1')).toBe('zero-drift:popup:footer-1')
  })

  it('reads what a browser saved under glide: before the rename', () => {
    const saved = storage({ 'glide:subscribed': '1700000000000', 'glide:size-units': 'in' })
    expect(readStored(saved, storageKey('subscribed'))).toBe('1700000000000')
    expect(readStored(saved, 'zero-drift:size-units')).toBe('in')
  })

  it('prefers the new entry when both exist, and returns null when neither does', () => {
    const both = storage({ 'zero-drift:pages': '3', 'glide:pages': '9' })
    expect(readStored(both, storageKey('pages'))).toBe('3')
    expect(readStored(storage({}), storageKey('pages'))).toBeNull()
  })

  it('leaves keys outside the Zero Drift prefix alone', () => {
    expect(readStored(storage({ 'glide:other': 'x' }), 'other')).toBeNull()
  })
})
