import { afterEach, describe, expect, it } from 'vitest'
import { emptyArticleForm, fromLocalInput, toLocalInput, toWrite } from './form-state'

const ORIGINAL_TZ = process.env.TZ

/* The article page renders on the server (UTC) and then in the browser (IST): the date
   fields must read and save the store's wall time (Asia/Kolkata) in both. */
describe.each(['UTC', 'Asia/Kolkata'])('article publish date with TZ=%s', (zone) => {
  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ
  })

  const withZone = () => {
    process.env.TZ = zone
  }

  it('shows a saved instant in Indian wall time', () => {
    withZone()
    expect(toLocalInput('2026-10-26T04:30:00.000Z')).toBe('2026-10-26T10:00')
    expect(toLocalInput(new Date('2026-10-26T20:00:00.000Z'))).toBe('2026-10-27T01:30')
    expect(toLocalInput(null)).toBe('')
  })

  it('saves a typed wall time as the Indian instant', () => {
    withZone()
    expect(fromLocalInput('2026-10-26T10:00')?.toISOString()).toBe('2026-10-26T04:30:00.000Z')
    expect(fromLocalInput('2026-10-27T01:30')?.toISOString()).toBe('2026-10-26T20:00:00.000Z')
    expect(fromLocalInput('')).toBeNull()
    expect(fromLocalInput('not a date')).toBeNull()
  })

  it('round-trips', () => {
    withZone()
    const at = '2026-12-31T18:29:00.000Z'
    expect(fromLocalInput(toLocalInput(at))?.toISOString()).toBe(at)
  })

  it('saves the scheduled publish time as the Indian instant', () => {
    withZone()
    const form = { ...emptyArticleForm('blog-1', 'Kuldeep'), publishedAt: '2026-11-01T09:00' }
    expect(toWrite(form).publishedAt?.toISOString()).toBe('2026-11-01T03:30:00.000Z')
    expect(toWrite(emptyArticleForm('blog-1', 'Kuldeep')).publishedAt).toBeNull()
  })
})
