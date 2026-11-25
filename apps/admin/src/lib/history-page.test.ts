import { describe, expect, it } from 'vitest'
import { HISTORY_PAGE, historyLimit, historyPage, nextShown } from './history-page'

const rows = (n: number) => Array.from({ length: n }, (_, i) => i)

describe('history paging', () => {
  it('asks the server for one line past the page, to know if there are more', () => {
    expect(historyLimit(HISTORY_PAGE)).toBe(HISTORY_PAGE + 1)
  })

  it('shows the newest 5 and says there are more', () => {
    expect(historyPage(rows(6), 5)).toEqual({ visible: rows(5), hasMore: true })
  })

  it('shows everything when it fits', () => {
    expect(historyPage(rows(3), 5)).toEqual({ visible: rows(3), hasMore: false })
    expect(historyPage(rows(5), 5)).toEqual({ visible: rows(5), hasMore: false })
  })

  it('opens 10 more at a time, never past what the API serves', () => {
    expect(nextShown(5)).toBe(15)
    expect(historyLimit(nextShown(195))).toBeLessThanOrEqual(200)
  })
})
