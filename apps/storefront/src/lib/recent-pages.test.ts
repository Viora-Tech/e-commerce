import { describe, expect, it } from 'vitest'
import { noteVisit, pagesToWarm } from './recent-pages'

const page = (path: string) => ({ host: 'shop.in', proto: 'https', path })

describe('recent pages', () => {
  it('keeps each store’s latest pages, most recent first, without repeats', () => {
    noteVisit('s1', page('/'), 1_000)
    noteVisit('s1', page('/products/a'), 2_000)
    noteVisit('s1', page('/'), 3_000)
    noteVisit('s2', page('/collections/x'), 3_000)
    expect(pagesToWarm('s1', 4_000).map((p) => p.path)).toEqual(['/', '/products/a'])
    expect(pagesToWarm('s2', 4_000).map((p) => p.path)).toEqual(['/collections/x'])
    expect(pagesToWarm('nobody', 4_000)).toEqual([])
  })

  it('keeps at most eight pages a store, and forgets ones not viewed for a day', () => {
    for (let i = 0; i < 12; i++) noteVisit('s3', page(`/pages/${i}`), 10_000 + i)
    const kept = pagesToWarm('s3', 20_000).map((p) => p.path)
    expect(kept).toHaveLength(8)
    expect(kept[0]).toBe('/pages/11')
    expect(pagesToWarm('s3', 10_011 + 24 * 60 * 60_000)).toEqual([])
  })
})
