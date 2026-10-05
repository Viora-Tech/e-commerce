/** SOURCE OF TRUTH: message catalogue tests — which messages can be switched off and how the off list changes */
import { PLATFORM_TEMPLATE_IDS, TEMPLATE_IDS } from '@commerce/notifications'
import { describe, expect, it } from 'vitest'
import { isMessageOn, MESSAGE_CATALOGUE, messageSwitchable, withMessage } from './messages'

describe('message catalogue', () => {
  it('lists every store template exactly once, and no platform template', () => {
    const storeTemplates = TEMPLATE_IDS.filter((id) => !PLATFORM_TEMPLATE_IDS.includes(id))
    expect(MESSAGE_CATALOGUE.map((m) => m.id).sort()).toEqual([...storeTemplates].sort())
  })

  it('only lets automatic messages be switched off', () => {
    expect(messageSwitchable('order_placed')).toBe(true)
    expect(messageSwitchable('login_code')).toBe(false)
    expect(messageSwitchable('payment_reminder')).toBe(false)
    expect(isMessageOn({ off: ['login_code'] }, 'login_code')).toBe(true)
  })

  it('adds and removes ids from the off list', () => {
    const off = withMessage({ off: [] }, 'order_shipped', false)
    expect(off).toEqual(['order_shipped'])
    expect(isMessageOn({ off }, 'order_shipped')).toBe(false)
    expect(withMessage({ off }, 'order_shipped', true)).toEqual([])
    expect(withMessage({ off }, 'login_code', false)).toEqual(off)
  })
})
