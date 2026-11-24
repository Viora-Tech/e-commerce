/** SOURCE OF TRUTH: shopper Points page lines — WHAT: a staff removal reads "Removed by the store", older lines behind "Show older" / WHY: owner report 24 Nov (a removal looked like a credit) */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PointsHistory, { describePoints } from './points-history'

const entry = (points: number) => ({
  id: `e${points}`,
  source: 'adjustment' as const,
  status: 'credited' as const,
  points,
  orderNumber: null,
  expiresOn: null,
  availableAt: new Date('2026-11-20T10:00:00Z'),
  createdAt: new Date('2026-11-20T10:00:00Z'),
})

describe('describePoints', () => {
  it('reads a staff removal as removed, an addition as from the store', () => {
    expect(describePoints(entry(-20))).toBe('Removed by the store')
    expect(describePoints(entry(50))).toBe('From the store')
  })
})

describe('PointsHistory', () => {
  const props = {
    points: 30,
    expiringSoon: null,
    pendingPoints: 0,
    birthday: null,
    entries: [entry(-20), entry(50)],
    timeZone: 'Asia/Kolkata',
  }

  it('links older lines when there are more', () => {
    const html = renderToStaticMarkup(
      createElement(PointsHistory, { ...props, moreHref: '?show=20' }),
    )
    expect(html).toContain('href="?show=20"')
    expect(html).toContain('Show older')
  })

  it('has no Show older at the end of the history', () => {
    const html = renderToStaticMarkup(createElement(PointsHistory, props))
    expect(html).not.toContain('Show older')
  })
})
