/** SOURCE OF TRUTH: tests for the SEO assistant's opportunity scoring and rows (opportunity.ts) — WHAT: the position weight, the band, the gap boost, ranking and the rows built from Google numbers / WHY: the assistant page, Fix with AI and the weekly email rank by these */
import { describe, expect, it } from 'vitest'
import type { SearchStats } from '../../search-console/insights'
import {
  assistantPath,
  assistantRows,
  inOpportunityBand,
  opportunityScore,
  positionWeight,
  type SeoAssistantSource,
} from './opportunity'

const stats = (impressions: number, position: number, clicks = 0): SearchStats => ({
  clicks,
  impressions,
  ctr: impressions ? clicks / impressions : 0,
  position,
})

describe('positionWeight', () => {
  it('is highest just below the top three and falls through the band', () => {
    expect(positionWeight(4)).toBe(1)
    expect(positionWeight(15)).toBeCloseTo(0.6)
    expect(positionWeight(8)).toBeGreaterThan(positionWeight(12))
  })
  it('gives little to the top three and to pages far down', () => {
    expect(positionWeight(1.5)).toBe(0.25)
    expect(positionWeight(20)).toBe(0.2)
    expect(positionWeight(45)).toBe(0.05)
    expect(positionWeight(0)).toBe(0)
  })
  it('knows the band edges', () => {
    expect(inOpportunityBand(4)).toBe(true)
    expect(inOpportunityBand(15)).toBe(true)
    expect(inOpportunityBand(3.9)).toBe(false)
    expect(inOpportunityBand(15.1)).toBe(false)
  })
})

describe('opportunityScore', () => {
  it('ranks many impressions in the band above the same number at the top', () => {
    expect(opportunityScore(stats(1000, 6))).toBeGreaterThan(opportunityScore(stats(1000, 2)))
  })
  it('ranks more impressions higher at the same position', () => {
    expect(opportunityScore(stats(2000, 9))).toBeGreaterThan(opportunityScore(stats(500, 9)))
  })
  it('boosts a weak title or description by a quarter', () => {
    expect(opportunityScore(stats(1000, 4), ['title_long'])).toBe(1250)
    expect(opportunityScore(stats(1000, 4), ['alt_missing'])).toBe(1000)
  })
  it('is 0 under the impression floor', () => {
    expect(opportunityScore(stats(9, 5))).toBe(0)
  })
})

describe('assistantRows', () => {
  const item = (
    id: string,
    handle: string,
    resource: SeoAssistantSource['resource'] = 'product',
  ): SeoAssistantSource => ({
    resource,
    id,
    title: id,
    handle,
    seoTitle: null,
    seoDescription: null,
    gaps: [],
  })

  it('lists items Google showed, biggest opportunity first, with top queries', () => {
    const current = new Map([
      ['/products/top', stats(800, 1.2, 200)],
      ['/products/near', stats(800, 7)],
      ['/collections/mice', stats(300, 10)],
    ])
    const rows = assistantRows(
      [
        item('top', 'top'),
        item('near', 'Near'),
        item('mice', 'mice', 'collection'),
        item('unseen', 'unseen'),
      ],
      {
        current,
        previous: new Map([['/products/near', stats(600, 11)]]),
        queries: new Map([
          [
            '/products/near',
            [
              { query: 'a', ...stats(10, 7) },
              { query: 'b', ...stats(500, 7) },
            ],
          ],
        ]),
      },
    )
    expect(rows.map((r) => r.id)).toEqual(['near', 'mice', 'top'])
    expect(rows[0]?.queries.map((q) => q.query)).toEqual(['b', 'a'])
    expect(rows[0]?.previous.position).toBe(11)
    expect(rows[0]?.inBand).toBe(true)
    expect(rows[2]?.previous.impressions).toBe(0)
  })

  it('matches paths in lowercase', () => {
    expect(assistantPath('page', 'About-Us')).toBe('/pages/about-us')
  })
})
