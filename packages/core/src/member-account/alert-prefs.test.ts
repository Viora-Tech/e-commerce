/** SOURCE OF TRUTH: member alert prefs tests — WHAT: defaults per role, and that prefs saved before an alert or the Push channel existed keep their choices and take the new defaults / WHY: adding a channel must never switch off an owner's saved email alerts */
import { describe, expect, it } from 'vitest'
import { alertOn, isPushAlert, parseMemberAlertPrefs } from './alert-prefs'

describe('parseMemberAlertPrefs', () => {
  it('starts every push alert on and the owner on email for orders and problems', () => {
    const p = parseMemberAlertPrefs(null, true)
    expect(p.newOrder).toEqual({ email: true, whatsapp: false, push: true })
    expect(p.inboxMessage).toEqual({ email: false, whatsapp: false, push: true })
    expect(p.dailySummary.push).toBe(false)
    expect(p.bugReports.push).toBe(false)
    expect(parseMemberAlertPrefs(null, false).newOrder.email).toBe(false)
  })

  it('keeps prefs saved before push and the new alerts, filling in their defaults', () => {
    const before = {
      newOrder: { email: false, whatsapp: true },
      lowStock: { email: false, whatsapp: false },
      paymentProblem: { email: true, whatsapp: false },
      dailySummary: { email: true, whatsapp: false, hour: 9, lastSentOn: '2026-11-15' },
      appErrors: { email: true, whatsapp: false },
    }
    const p = parseMemberAlertPrefs(before, true)
    expect(p.newOrder).toEqual({ email: false, whatsapp: true, push: true })
    expect(p.approvalWaiting).toEqual({ email: false, whatsapp: false, push: true })
    expect(p.bugReports).toEqual({ email: true, whatsapp: false, push: false })
    expect(p.dailySummary).toMatchObject({ hour: 9, lastSentOn: '2026-11-15', push: false })
  })

  it('a member who turned push off keeps it off', () => {
    const p = parseMemberAlertPrefs(
      {
        newOrder: { email: true, whatsapp: false, push: false },
        lowStock: { email: false, whatsapp: false },
        paymentProblem: { email: false, whatsapp: false },
        dailySummary: { email: false, whatsapp: false, hour: 20 },
        appErrors: { email: false, whatsapp: false },
      },
      false,
    )
    expect(p.newOrder.push).toBe(false)
    // Push alone never sends an email or WhatsApp.
    expect(
      alertOn({ ...p, lowStock: { email: false, whatsapp: false, push: true } }, 'lowStock'),
    ).toBe(false)
  })

  it('knows which alerts push carries', () => {
    expect(isPushAlert('approvalWaiting')).toBe(true)
    expect(isPushAlert('dailySummary')).toBe(false)
  })
})
