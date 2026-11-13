import { describe, expect, it } from 'vitest'
import { waitingLabel } from '../src/app-bar'
import {
  defaultBackInStockStoreSettings,
  parseBackInStockStoreSettings,
  restockMinutes,
} from '../src/settings'

describe('settings schema defaults', () => {
  it('fills the storefront settings so existing stores keep today’s form', () => {
    expect(defaultBackInStockStoreSettings.buttonText).toBe('')
    expect(defaultBackInStockStoreSettings.askPhone).toBe(true)
    expect(defaultBackInStockStoreSettings.batchSize).toBe(200)
  })

  it('reads a row saved before the storefront settings existed', () => {
    const old = { emailEnabled: false, whatsappEnabled: true, batchSize: 60, unlimited: false }
    const parsed = parseBackInStockStoreSettings(old)
    expect(parsed).toMatchObject({ ...old, buttonText: '', askPhone: true })
  })

  it('trims the button text and keeps a chosen one', () => {
    expect(
      parseBackInStockStoreSettings({ buttonText: "  Notify me when it's back " }).buttonText,
    ).toBe("Notify me when it's back")
  })

  it('falls back to the defaults on a broken row rather than throwing', () => {
    expect(parseBackInStockStoreSettings({ buttonText: 'x'.repeat(61) })).toEqual(
      defaultBackInStockStoreSettings,
    )
    expect(parseBackInStockStoreSettings(null)).toEqual(defaultBackInStockStoreSettings)
  })
})

describe('restockMinutes (the "500 signups ≈ 8 minutes" hint)', () => {
  it('rounds signups over the per-minute pace', () => {
    expect(restockMinutes(500, 60)).toBe(8)
    expect(restockMinutes(500, 30)).toBe(17)
    expect(restockMinutes(500, 10)).toBe(50)
    expect(restockMinutes(500, 200)).toBe(3)
    expect(restockMinutes(500, 120)).toBe(4)
  })

  it('is 0 when the whole restock fits in the first minute', () => {
    expect(restockMinutes(500, 500)).toBe(0)
    expect(restockMinutes(500, 2000)).toBe(0)
  })

  it('never reads under a minute once it spills past the first', () => {
    expect(restockMinutes(500, 499)).toBe(1)
  })

  it('is 0 for nothing to send or a nonsense pace', () => {
    expect(restockMinutes(0, 60)).toBe(0)
    expect(restockMinutes(500, 0)).toBe(0)
    expect(restockMinutes(500, Number.NaN)).toBe(0)
  })
})

describe('waitingLabel', () => {
  it('matches the app bar pill', () => {
    expect(waitingLabel(128, 14)).toBe('128 shoppers waiting on 14 variants')
    expect(waitingLabel(1, 1)).toBe('1 shopper waiting on 1 variant')
    expect(waitingLabel(1500, 2)).toBe('1,500 shoppers waiting on 2 variants')
  })
})
