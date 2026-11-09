import { describe, expect, it } from 'vitest'
import { needsNotFoundMarkup } from './not-found-rule'

describe('needsNotFoundMarkup', () => {
  const page = { imported: true, flightOnly: false, rerender: false }

  it('leaves the 404 markup out of an imported theme page load', () => {
    expect(needsNotFoundMarkup(page)).toBe(false)
  })

  it('keeps it for the themed reload and for a payload-only answer', () => {
    expect(needsNotFoundMarkup({ ...page, rerender: true })).toBe(true)
    expect(needsNotFoundMarkup({ ...page, flightOnly: true })).toBe(true)
  })

  it('keeps it for our own themes, which draw a 404 from the payload', () => {
    expect(needsNotFoundMarkup({ ...page, imported: false })).toBe(true)
  })
})
