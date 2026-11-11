/** SOURCE OF TRUTH: default delivery card tests — WHAT: the cheapest card is ticked, the shopper's own pick survives a new answer, checkout's automatic pick does not / WHY: a paid Express card was ticked for shoppers on Waimers (#1519). */
import { describe, expect, it } from 'vitest'
import { cheapestRateId, nextRateId } from './default-rate'

const express = { id: 'express', pricePaise: 5000 }
const standard = { id: 'standard', pricePaise: 0 }

describe('cheapestRateId', () => {
  it('ticks the free Standard card even when paid Express is listed first', () => {
    expect(cheapestRateId([express, standard])).toBe('standard')
  })

  it('keeps the store order between equal prices, and is null with no cards', () => {
    expect(cheapestRateId([{ id: 'a', pricePaise: 0 }, standard])).toBe('a')
    expect(cheapestRateId([])).toBeNull()
  })
})

describe('nextRateId', () => {
  it('keeps the card the shopper picked while it is offered', () => {
    expect(nextRateId([standard, express], 'express', true)).toBe('express')
  })

  it('moves to the cheapest when the shopper’s card is gone', () => {
    expect(nextRateId([standard], 'express', true)).toBe('standard')
  })

  it('re-picks checkout’s own default when prices change', () => {
    const later = [
      { id: 'standard', pricePaise: 9000 },
      { id: 'express', pricePaise: 5000 },
    ]
    expect(nextRateId(later, 'standard', false)).toBe('express')
  })

  it('ticks the cheapest on the first answer', () => {
    expect(nextRateId([express, standard], null, false)).toBe('standard')
  })
})
