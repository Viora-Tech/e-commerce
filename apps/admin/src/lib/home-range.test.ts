import { describe, expect, it } from 'vitest'
import { decodeHomeRange, encodeHomeRange, rangeFor } from './home-range'

const NOW = new Date('2026-11-11T06:00:00Z')

describe('the remembered Home range', () => {
  it('keeps a custom range with its own dates and comparison', () => {
    const saved = encodeHomeRange(
      { preset: 'custom', from: '2026-11-01', to: '2026-11-10' },
      'year',
    )
    expect(decodeHomeRange(saved, NOW)).toEqual({
      range: { preset: 'custom', from: '2026-11-01', to: '2026-11-10' },
      compare: 'year',
    })
  })

  it('rolls a preset forward to today', () => {
    const saved = encodeHomeRange(rangeFor('7d', new Date('2026-11-01T06:00:00Z')), 'previous')
    expect(decodeHomeRange(saved, NOW)?.range).toEqual({
      preset: '7d',
      from: '2026-11-05',
      to: '2026-11-11',
    })
  })

  it('ignores a missing or broken cookie', () => {
    expect(decodeHomeRange(undefined, NOW)).toBeNull()
    expect(decodeHomeRange('nonsense', NOW)).toBeNull()
    expect(decodeHomeRange('custom.2026-11-10.2026-11-01.previous', NOW)).toBeNull()
    expect(decodeHomeRange('custom.2026-12-01.2026-12-02.previous', NOW)).toBeNull()
    expect(decodeHomeRange('7d.x.y.sideways', NOW)).toBeNull()
  })
})
