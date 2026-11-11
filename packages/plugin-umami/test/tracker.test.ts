import { describe, expect, it } from 'vitest'
import { syncUmamiOptOut, UMAMI_DISABLED_KEY } from '../src/tracker'

/** A `localStorage` stand-in. */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

/*
 * Umami's tracker keeps counting client-side page views once loaded; React removing its
 * <script> does not stop it. Its own off switch is the `umami.disabled` key it reads before
 * every send, so a "no" on the banner must set it, and a later "yes" clear it.
 */
describe('syncUmamiOptOut', () => {
  it('a no turns the loaded tracker off at once', () => {
    const storage = memoryStorage()
    syncUmamiOptOut(storage, false)
    expect(storage.getItem(UMAMI_DISABLED_KEY)).toBeTruthy()
  })

  it('a later yes turns it back on', () => {
    const storage = memoryStorage()
    syncUmamiOptOut(storage, false)
    syncUmamiOptOut(storage, true)
    expect(storage.getItem(UMAMI_DISABLED_KEY)).toBeNull()
  })

  it("keeps the merchant's own opt-out (their own visits) on a yes", () => {
    const storage = memoryStorage({ [UMAMI_DISABLED_KEY]: '1' })
    syncUmamiOptOut(storage, true)
    expect(storage.getItem(UMAMI_DISABLED_KEY)).toBe('1')
    syncUmamiOptOut(storage, false)
    syncUmamiOptOut(storage, true)
    expect(storage.getItem(UMAMI_DISABLED_KEY)).toBe('1')
  })

  it('storage that throws (blocked) never breaks the page', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect(() => syncUmamiOptOut(blocked, false)).not.toThrow()
  })
})
