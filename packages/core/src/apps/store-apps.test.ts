/** SOURCE OF TRUTH: storeAppsRow tests — WHAT: the store's `apps` record is read once per request by every reader that goes through it, and on every call when no request memo is set / WHY: one uncached storefront page read the same row 14 times (11 Nov 2026) */
import type { StoreTx } from '@commerce/db'
import { afterEach, describe, expect, it } from 'vitest'
import { codRtoState } from '../cod-rto/risk'
import { gstInvoicesInstalled } from '../documents/service'
import { pixelsInstalled } from '../pixels/connections'
import {
  appBlockSourcesForStore,
  appEmbedSourcesForStore,
  installedStorage,
  registriesForStore,
} from '../plugins/registries'
import { memoPerRequest, peekPerRequest, rememberPerRequest, setRequestMemo } from '../request-memo'
import { deliveryOptionsInstalled } from '../shipping/delivery-options/service'
import { storeThemePacks } from '../theme/library'
import { storeAppsRow, storeAppsSettings } from './store-apps'

const STORE = '0192f0a1-0000-7000-8000-000000000001'

/** A transaction that answers every select with one store row and counts the queries. */
function countingTx(apps: unknown = { installed: ['reviews'] }) {
  const tx = {
    queries: 0,
    select: () => ({
      from: () => ({
        where: async () => {
          tx.queries += 1
          return [{ apps, storage: null }]
        },
      }),
    }),
  }
  return tx
}

/** Every reader of the record a storefront page runs, twice over (14 reads). */
async function readEverything(tx: StoreTx) {
  for (let i = 0; i < 2; i++) {
    await registriesForStore(tx, STORE)
    await installedStorage(tx, STORE)
    await appBlockSourcesForStore(tx, STORE)
    await appEmbedSourcesForStore(tx, STORE)
    await storeThemePacks(tx, STORE)
    await deliveryOptionsInstalled(tx, STORE)
    await pixelsInstalled(tx, STORE)
  }
}

afterEach(() => setRequestMemo(null))

describe('storeAppsRow', () => {
  it('reads the row on every call when no request memo is set (as before)', async () => {
    const tx = countingTx()
    await readEverything(tx as unknown as StoreTx)
    expect(tx.queries).toBe(14)
  })

  it('reads it once per request with the memo on', async () => {
    const memo = new Map<string, Promise<unknown>>()
    setRequestMemo(() => memo)
    const tx = countingTx()
    await readEverything(tx as unknown as StoreTx)
    await gstInvoicesInstalled(tx as unknown as StoreTx, STORE)
    await codRtoState(tx as unknown as StoreTx, STORE)
    expect(tx.queries).toBe(1)
  })

  it('starts over for the next request', async () => {
    let memo = new Map<string, Promise<unknown>>()
    setRequestMemo(() => memo)
    const tx = countingTx()
    await storeAppsRow(tx as unknown as StoreTx, STORE)
    memo = new Map()
    await storeAppsRow(tx as unknown as StoreTx, STORE)
    expect(tx.queries).toBe(2)
  })

  it('keys by store', async () => {
    const memo = new Map<string, Promise<unknown>>()
    setRequestMemo(() => memo)
    const tx = countingTx()
    await storeAppsRow(tx as unknown as StoreTx, STORE)
    await storeAppsRow(tx as unknown as StoreTx, '0192f0a1-0000-7000-8000-000000000002')
    expect(tx.queries).toBe(2)
  })

  it('hands each caller its own parsed record', async () => {
    const memo = new Map<string, Promise<unknown>>()
    setRequestMemo(() => memo)
    const tx = countingTx({ installed: ['forms'] })
    const a = await storeAppsSettings(tx as unknown as StoreTx, STORE)
    a.installed.push('changed')
    const b = await storeAppsSettings(tx as unknown as StoreTx, STORE)
    expect(b.installed).toEqual(['forms'])
  })
})

describe('memoPerRequest', () => {
  it('forgets a failed load so the next caller tries again', async () => {
    const memo = new Map<string, Promise<unknown>>()
    setRequestMemo(() => memo)
    let calls = 0
    const load = async () => {
      calls += 1
      if (calls === 1) throw new Error('down')
      return 'ok'
    }
    await expect(memoPerRequest('k', load)).rejects.toThrow('down')
    await expect(memoPerRequest('k', load)).resolves.toBe('ok')
    await expect(memoPerRequest('k', load)).resolves.toBe('ok')
    expect(calls).toBe(2)
  })

  it('peeks what the request remembered or loaded; nothing when off or failed', async () => {
    rememberPerRequest('off', 1)
    expect(await peekPerRequest('off')).toBeUndefined()
    const memo = new Map<string, Promise<unknown>>()
    setRequestMemo(() => memo)
    expect(await peekPerRequest('a')).toBeUndefined()
    rememberPerRequest('a', { html: '<p>' })
    expect(await peekPerRequest('a')).toEqual({ html: '<p>' })
    memo.set('broken', Promise.reject(new Error('down')))
    expect(await peekPerRequest('broken')).toBeUndefined()
  })
})
