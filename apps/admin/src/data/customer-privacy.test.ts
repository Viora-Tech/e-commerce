import { describe, expect, it } from 'vitest'
import { customerPrivacyContent } from './customer-privacy'

const { stats } = customerPrivacyContent.banner

describe('cookie banner stats', () => {
  it('reads shown / answered / accepted marketing, with the ignored visits', () => {
    expect(stats(120, 63, 50, 46)).toBe(
      'Last 30 days: banner shown 120 times, 63 answers. 50 allowed analytics, 46 allowed marketing. 57 left it unanswered.',
    )
  })

  it('leaves out the ignored count when every showing was answered', () => {
    expect(stats(1, 1, 0, 1)).toBe(
      'Last 30 days: banner shown once, 1 answer. 0 allowed analytics, 1 allowed marketing.',
    )
  })

  it('still reports answers from before the shown count existed', () => {
    expect(stats(0, 63, 50, 46)).toBe(
      'Last 30 days: 63 answers. 50 allowed analytics, 46 allowed marketing.',
    )
  })

  it('says when nothing happened', () => {
    expect(stats(0, 0, 0, 0)).toBe('No answers in the last 30 days yet.')
  })
})
