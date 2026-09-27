import { describe, expect, it } from 'vitest'
import {
  appSettingsOf,
  installApp,
  parseAppsSettings,
  uninstallApp,
  withAppSettings,
} from './settings'

describe('apps settings', () => {
  it('defaults to nothing installed on garbage', () => {
    expect(parseAppsSettings(null)).toEqual({ installed: [] })
    expect(parseAppsSettings({ installed: 'razorpay' })).toEqual({ installed: [] })
  })

  it('install is idempotent and keeps order', () => {
    const a = installApp({ installed: [] }, 'razorpay')
    const b = installApp(installApp(a, 'delhivery'), 'razorpay')
    expect(b.installed).toEqual(['razorpay', 'delhivery'])
  })

  it('uninstall removes only that plugin', () => {
    expect(uninstallApp({ installed: ['razorpay', 'delhivery'] }, 'razorpay')).toEqual({
      installed: ['delhivery'],
    })
  })
})

describe('per-app settings on store.apps', () => {
  it('keeps each app entry through install and uninstall', () => {
    const saved = withAppSettings({ installed: ['emi-pay-later'] }, 'emi-pay-later', { a: 1 })
    const gone = uninstallApp(saved, 'emi-pay-later')
    expect(gone.installed).toEqual([])
    expect(appSettingsOf(gone, 'emi-pay-later')).toEqual({ a: 1 })
    expect(appSettingsOf(installApp(gone, 'emi-pay-later'), 'emi-pay-later')).toEqual({ a: 1 })
  })

  it('leaves other apps alone and round-trips through parse', () => {
    const s = withAppSettings(withAppSettings({ installed: [] }, 'one', { x: true }), 'two', {
      y: 2,
    })
    const parsed = parseAppsSettings(JSON.parse(JSON.stringify(s)))
    expect(appSettingsOf(parsed, 'one')).toEqual({ x: true })
    expect(appSettingsOf(parsed, 'two')).toEqual({ y: 2 })
    expect(appSettingsOf(parsed, 'three')).toBeUndefined()
  })
})
