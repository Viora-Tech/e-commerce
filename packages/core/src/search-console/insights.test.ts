/** SOURCE OF TRUTH: tests for the Search Console rules (insights.ts) — WHAT: URL to path matching, adding rows up, the change and the opportunity lists / WHY: the app, the product card and the SEO report share them */
import { describe, expect, it } from 'vitest'
import {
  almostPageOne,
  compareStats,
  EMPTY_STATS,
  isLowCtr,
  losingTraffic,
  percentChange,
  type SearchRow,
  type SearchStats,
  searchPath,
  searchPathKind,
  statsBy,
  sumStats,
} from './insights'

const stats = (clicks: number, impressions: number, position: number): SearchStats => ({
  clicks,
  impressions,
  position,
  ctr: impressions ? clicks / impressions : 0,
})

const row = (path: string, clicks: number, impressions: number, position: number): SearchRow => ({
  period: 'current',
  dimension: 'page',
  page: `https://shop.example.in${path}`,
  path,
  query: null,
  segment: null,
  clicks,
  impressions,
  position,
})

describe('searchPath', () => {
  it.each([
    ['https://shop.example.in/products/Blue-Kurta/', '/products/blue-kurta'],
    ['https://www.shop.example.in/products/blue-kurta?variant=1', '/products/blue-kurta'],
    ['https://shop.example.in/collections/summer/products/blue-kurta', '/products/blue-kurta'],
    ['https://shop.example.in/', '/'],
    ['https://shop.example.in/pages/about%20us', '/pages/about us'],
    ['not a url', null],
  ])('%s → %s', (url, path) => {
    expect(searchPath(url)).toBe(path)
  })
})

describe('searchPathKind', () => {
  it('names products, collections, pages and the home page', () => {
    expect(searchPathKind('/products/blue-kurta')).toEqual({
      kind: 'product',
      handle: 'blue-kurta',
    })
    expect(searchPathKind('/collections/summer')).toEqual({ kind: 'collection', handle: 'summer' })
    expect(searchPathKind('/pages/about')).toEqual({ kind: 'page', handle: 'about' })
    expect(searchPathKind('/')).toEqual({ kind: 'home', handle: null })
    expect(searchPathKind('/blogs/news/hello')).toEqual({ kind: 'other', handle: null })
  })
})

describe('sumStats', () => {
  it('weighs position by impressions and works out the click rate', () => {
    const s = sumStats([row('/a', 10, 100, 2), row('/a', 0, 300, 10)])
    expect(s.clicks).toBe(10)
    expect(s.impressions).toBe(400)
    expect(s.ctr).toBeCloseTo(0.025)
    expect(s.position).toBeCloseTo(8)
  })

  it('is empty for no rows', () => {
    expect(sumStats([])).toEqual(EMPTY_STATS)
  })
})

describe('percentChange', () => {
  it('rounds to one decimal and has no answer from zero', () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(1, 3)).toBe(-66.7)
    expect(percentChange(0, 0)).toBe(0)
    expect(percentChange(5, 0)).toBeNull()
  })
})

describe('ranked lists', () => {
  const now = statsBy(
    [row('/a', 30, 300, 3), row('/b', 5, 500, 12), row('/c', 0, 50, 15)],
    (r) => r.path,
  )
  const before = statsBy(
    [row('/a', 10, 200, 4), row('/b', 25, 400, 6), row('/d', 8, 80, 5)],
    (r) => r.path,
  )

  it('compares each entry with the period before, most clicks first', () => {
    const list = compareStats(now, before)
    expect(list.map((c) => c.key)).toEqual(['/a', '/b', '/c'])
    expect(list[0]?.clickDelta).toBe(20)
    expect(list[2]?.previous).toEqual(EMPTY_STATS)
  })

  it('lists the biggest click drops, including pages that vanished', () => {
    expect(losingTraffic(now, before).map((c) => [c.key, c.clickDelta])).toEqual([
      ['/b', -20],
      ['/d', -8],
    ])
  })

  it('lists pages just off page 1 with enough views', () => {
    expect(almostPageOne(now).map(([key]) => key)).toEqual(['/b'])
  })
})

describe('isLowCtr', () => {
  it('needs many views, a top spot and far fewer clicks than usual', () => {
    expect(isLowCtr(stats(5, 1000, 2))).toBe(true)
    expect(isLowCtr(stats(200, 1000, 2))).toBe(false)
    expect(isLowCtr(stats(5, 100, 2))).toBe(false)
    expect(isLowCtr(stats(0, 1000, 15))).toBe(false)
  })
})
