import { describe, expect, it } from 'vitest'
import { ACCOUNT_HISTORY_PAGE, accountHistory, shownFrom } from './account-history'

const rows = (n: number) => Array.from({ length: n }, (_, i) => i)

describe('account history paging', () => {
  it('starts at one page and reads ?show= within bounds', () => {
    expect(shownFrom(undefined)).toBe(ACCOUNT_HISTORY_PAGE)
    expect(shownFrom('nope')).toBe(ACCOUNT_HISTORY_PAGE)
    expect(shownFrom('3')).toBe(ACCOUNT_HISTORY_PAGE)
    expect(shownFrom('30')).toBe(30)
    expect(shownFrom(['40', '50'])).toBe(40)
    expect(shownFrom('99999')).toBe(199)
  })

  it('shows one page and links the next when older lines exist', () => {
    const page = accountHistory(rows(11), 10)
    expect(page.visible).toEqual(rows(10))
    expect(page.moreHref).toBe('?show=20')
  })

  it('has no link when everything fits', () => {
    expect(accountHistory(rows(10), 10)).toEqual({ visible: rows(10), moreHref: null })
  })
})
