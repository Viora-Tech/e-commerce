import { describe, expect, it } from 'vitest'
import { saleSourceContent } from '@/data/sale-source'
import { saleSourceRows, sourceMedium } from './sale-source'

const AT = '2026-11-18T10:00:00.000Z'

describe('saleSourceRows', () => {
  it('lists the channel, then only what the visit recorded', () => {
    const rows = saleSourceRows(
      {
        channel: 'paid_search',
        source: 'google',
        medium: 'cpc',
        campaign: 'diwali',
        referrer: 'google.com',
        landing: '/products/pad',
        at: AT,
      },
      saleSourceContent,
    )
    expect(rows.map((r) => [r.key, r.value])).toEqual([
      ['channel', 'Paid search'],
      ['cameFrom', 'google.com'],
      ['sourceMedium', 'google / cpc'],
      ['campaign', 'diwali'],
      ['landing', '/products/pad'],
    ])
  })

  it('shows a direct visit as the channel alone, and an affiliate code when there is one', () => {
    expect(saleSourceRows({ channel: 'direct', at: AT }, saleSourceContent)).toEqual([
      { key: 'channel', label: 'Channel', value: 'Direct' },
    ])
    const rows = saleSourceRows({ channel: 'affiliate', ref: 'riya', at: AT }, saleSourceContent)
    expect(rows.at(-1)).toEqual({ key: 'affiliate', label: 'Affiliate code', value: 'riya' })
  })

  it('keeps a channel it has no name for as recorded', () => {
    expect(saleSourceRows({ channel: 'newsletter_v2' }, saleSourceContent)[0]?.value).toBe(
      'newsletter_v2',
    )
  })
})

describe('sourceMedium', () => {
  it('joins what is there and is null without UTM tags', () => {
    expect(sourceMedium({ channel: 'social', source: 'instagram' })).toBe('instagram')
    expect(sourceMedium({ channel: 'email', medium: 'email' })).toBe('email')
    expect(sourceMedium({ channel: 'direct' })).toBeNull()
  })
})
