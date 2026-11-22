import { describe, expect, it } from 'vitest'
import { cancelChoices, splitCourierPickups } from './courier-pickup'

describe('cancelChoices (owner, 23 Nov 2026)', () => {
  it('offers Cancel pickup on a pickup the store asked for (Delhivery and the rest)', () => {
    expect(cancelChoices('created', true, null)).toEqual(['back', 'shipment', 'marked'])
  })

  it('never offers it when the courier scheduled its own pickup at booking (RapidShyp)', () => {
    expect(cancelChoices('created', true, 'RapidShyp')).toEqual(['shipment', 'marked'])
    expect(cancelChoices('created', false, 'RapidShyp')).toEqual(['shipment', 'marked'])
  })

  it('after pickup it is bring back or already cancelled, whatever the courier', () => {
    expect(cancelChoices('in_transit', true, 'RapidShyp')).toEqual(['sendBack', 'marked'])
    expect(cancelChoices('picked_up', true, null)).toEqual(['sendBack', 'marked'])
  })
})

describe('splitCourierPickups', () => {
  it('keeps the parcels a pickup action may take and names the courier left out', () => {
    expect(splitCourierPickups(['a', 'b', 'c'], { b: 'RapidShyp' })).toEqual({
      movable: ['a', 'c'],
      courier: 'RapidShyp',
    })
    expect(splitCourierPickups(['a'], {})).toEqual({ movable: ['a'], courier: null })
  })
})
