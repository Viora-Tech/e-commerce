import { beforeEach, describe, expect, it } from 'vitest'
import { holdForUnsaved, noteRefreshed, STALE_MS, shouldRefresh } from './focus-refresh'

/** Facts for a merchant coming back to the Orders list `ago` ms after the last read. */
const back = (ago: number, extra: Partial<Parameters<typeof shouldRefresh>[0]> = {}) => ({
  now: Date.now() + ago,
  pathname: '/orders',
  online: true,
  dialogOpen: false,
  ...extra,
})

describe('refresh on focus', () => {
  beforeEach(() => noteRefreshed())

  it('reads the page again once it is older than 30 s', () => {
    expect(shouldRefresh(back(STALE_MS + 1))).toBe(true)
  })

  it('leaves a page read under 30 s ago alone', () => {
    expect(shouldRefresh(back(STALE_MS - 1_000))).toBe(false)
  })

  it('waits while offline or while a dialog is open', () => {
    expect(shouldRefresh(back(STALE_MS + 1, { online: false }))).toBe(false)
    expect(shouldRefresh(back(STALE_MS + 1, { dialogOpen: true }))).toBe(false)
  })

  it('waits while a form has unsaved changes, and again refreshes once released', () => {
    const release = holdForUnsaved()
    expect(shouldRefresh(back(STALE_MS + 1))).toBe(false)
    release()
    release() // a second release is harmless
    expect(shouldRefresh(back(STALE_MS + 1))).toBe(true)
  })

  it('skips pages that update themselves', () => {
    expect(shouldRefresh(back(STALE_MS + 1, { pathname: '/analytics/live' }))).toBe(false)
    expect(shouldRefresh(back(STALE_MS + 1, { pathname: '/dev/editor' }))).toBe(false)
    expect(shouldRefresh(back(STALE_MS + 1, { pathname: '/analytics/liveness' }))).toBe(true)
  })
})
