import { describe, expect, it } from 'vitest'
import { installApp, parseAppsSettings, uninstallApp } from './settings'

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
