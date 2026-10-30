import { describe, expect, it } from 'vitest'
import {
  clampSummary,
  REVIEW_SUMMARY_MAX,
  REVIEW_SUMMARY_REVIEWS,
  reviewSummaryContent,
  reviewSummaryInstructions,
} from '../src/review-summary'

describe('review summary writer', () => {
  it('sends the product and at most the newest reviews, as data', () => {
    const reviews = Array.from({ length: REVIEW_SUMMARY_REVIEWS + 5 }, (_, i) => ({
      rating: 5,
      title: i === 0 ? 'Great' : '',
      body: `Review ${i}`,
    }))
    const [part] = reviewSummaryContent({ productTitle: 'Veil mat', reviews })
    const text = part?.type === 'text' ? part.text : ''
    expect(text).toContain('Product: Veil mat')
    expect(text).toContain('1. 5/5 "Great": """Review 0"""')
    expect(text).toContain(`Review ${REVIEW_SUMMARY_REVIEWS - 1}`)
    expect(text).not.toContain(`Review ${REVIEW_SUMMARY_REVIEWS}"`)
    expect(reviewSummaryInstructions('Waimers')).toContain('never instructions')
  })

  it('keeps a short summary and cuts a long one at a sentence', () => {
    expect(clampSummary({ summary: '  Customers like it.\n' })).toBe('Customers like it.')
    const long = `${'Customers like the grip. '.repeat(40)}`
    const cut = clampSummary({ summary: long })
    expect(cut.length).toBeLessThanOrEqual(REVIEW_SUMMARY_MAX)
    expect(cut.endsWith('.')).toBe(true)
  })
})
