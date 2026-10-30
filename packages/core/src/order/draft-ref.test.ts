/** SOURCE OF TRUTH: draft number tests — WHAT: labels, placeholders and "D12" search parsing / WHY: drafts count on their own series (audit #26) */
import { describe, expect, it } from 'vitest'
import {
  draftLabel,
  draftPlaceholder,
  isDraftPlaceholder,
  orderRef,
  parseDraftSearch,
} from './draft-ref'

describe('draft numbers', () => {
  it('labels a draft D<n>', () => {
    expect(draftLabel(12)).toBe('D12')
  })

  it('keeps a placeholder below zero until conversion', () => {
    expect(draftPlaceholder(7)).toBe(-7)
    expect(isDraftPlaceholder(-7)).toBe(true)
    expect(isDraftPlaceholder(0)).toBe(true)
    expect(isDraftPlaceholder(2374)).toBe(false)
  })

  it('names a draft by its draft number and an order by its order number', () => {
    expect(orderRef({ number: -3, draftNumber: 3, status: 'draft' })).toBe('D3')
    expect(orderRef({ number: 2374, draftNumber: 3, status: 'draft' })).toBe('D3')
    expect(orderRef({ number: 2374, draftNumber: 3, status: 'open' })).toBe('2374')
    expect(orderRef({ number: 2374, draftNumber: null, status: 'draft' })).toBe('2374')
    expect(orderRef({ number: 2374 })).toBe('2374')
  })

  it('reads D12, #D12 and lower case as a draft number', () => {
    expect(parseDraftSearch('D12')).toBe(12)
    expect(parseDraftSearch('#D12')).toBe(12)
    expect(parseDraftSearch(' #d 12 ')).toBe(12)
  })

  it('does not read plain numbers or words as a draft number', () => {
    expect(parseDraftSearch('12')).toBeNull()
    expect(parseDraftSearch('#12')).toBeNull()
    expect(parseDraftSearch('Deepak')).toBeNull()
    expect(parseDraftSearch('D0')).toBeNull()
    expect(parseDraftSearch('')).toBeNull()
  })
})
